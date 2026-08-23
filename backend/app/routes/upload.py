import uuid

import pymupdf
from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile
from firebase_admin import firestore

from app.db.firebase import bucket, db
from app.dependencies import get_current_user_id
from app.services.processing import process_pdf

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
MAX_PAGES = 200


def parse_pages(pages: str, page_count: int) -> list[int]:
    if pages == "all":
        return list(range(1, page_count + 1))

    try:
        requested = [int(p) for p in pages.split(",")]
    except ValueError:
        raise HTTPException(status_code=400, detail="pages must be 'all' or comma-separated page numbers")

    if any(p < 1 or p > page_count for p in requested):
        raise HTTPException(status_code=400, detail=f"pages must be between 1 and {page_count}")

    return requested


@router.post("/upload")
def upload_file(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    pages: str = Form("all"),
    user_id: str = Depends(get_current_user_id),
):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="File must be a PDF")

    contents = file.file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 50 MB limit")

    if not contents.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")

    pdf = pymupdf.open(stream=contents, filetype="pdf")
    if pdf.is_encrypted:
        raise HTTPException(
            status_code=400,
            detail="PDF is password-protected. Please remove the password and try again.",
        )

    page_count = pdf.page_count
    if page_count > MAX_PAGES:
        raise HTTPException(status_code=400, detail=f"PDF exceeds {MAX_PAGES} page limit")

    pages_to_process = parse_pages(pages, page_count)

    file_id = str(uuid.uuid4())
    storage_path = f"pdfs/{file_id}/original.pdf"
    blob = bucket.blob(storage_path)
    blob.upload_from_string(contents, content_type=file.content_type)

    db.collection("pdfs").document(file_id).set(
        {
            "filename": file.filename,
            "content_type": file.content_type,
            "storage_path": storage_path,
            "page_count": page_count,
            "uploaded_at": firestore.SERVER_TIMESTAMP,
            "user_id": user_id,
            # The PDF itself is already validated and stored at this point -
            # "reading" reflects that real step. process_pdf() (below) then
            # takes it through the rest of the real pipeline.
            "status": "processing",
            "stage": "reading",
            "pages_processed": 0,
            "pages_total": len(pages_to_process),
            "error": None,
        }
    )

    background_tasks.add_task(process_pdf, file_id, pages_to_process)

    return {"id": file_id, "filename": file.filename, "page_count": page_count}
