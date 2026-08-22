import pymupdf
from fastapi import APIRouter, HTTPException

from app.db.firebase import bucket, db
from app.services.extraction import extract_segments

router = APIRouter()


@router.get("/pdfs/{pdf_id}/pages/{page_number}/segments")
def get_page_segments(pdf_id: str, page_number: int):
    doc_ref = db.collection("pdfs").document(pdf_id).get()
    if not doc_ref.exists:
        raise HTTPException(status_code=404, detail="PDF not found")

    pdf_data = doc_ref.to_dict()
    page_count = pdf_data["page_count"]

    if page_number < 1 or page_number > page_count:
        raise HTTPException(status_code=400, detail=f"page_number must be between 1 and {page_count}")

    contents = bucket.blob(pdf_data["storage_path"]).download_as_bytes()
    pdf = pymupdf.open(stream=contents, filetype="pdf")
    page = pdf[page_number - 1]

    segments = extract_segments(page)

    return {"pdf_id": pdf_id, "page": page_number, "segment_count": len(segments), "segments": segments}
