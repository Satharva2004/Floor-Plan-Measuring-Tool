import pymupdf
from fastapi import HTTPException

from app.db.firebase import bucket, db
from app.services import cache


def _get_pdf_bytes(pdf_id: str, storage_path: str) -> bytes:
    cache_key = f"pdf_bytes:{pdf_id}"
    contents = cache.get(cache_key)
    if contents is None:
        contents = bucket.blob(storage_path).download_as_bytes()
        cache.set(cache_key, contents)
    return contents


def load_page(pdf_id: str, page_number: int):
    doc_ref = db.collection("pdfs").document(pdf_id).get()
    if not doc_ref.exists:
        raise HTTPException(status_code=404, detail="PDF not found")

    pdf_data = doc_ref.to_dict()
    page_count = pdf_data["page_count"]

    if page_number < 1 or page_number > page_count:
        raise HTTPException(status_code=400, detail=f"page_number must be between 1 and {page_count}")

    contents = _get_pdf_bytes(pdf_id, pdf_data["storage_path"])
    pdf = pymupdf.open(stream=contents, filetype="pdf")
    return pdf[page_number - 1]
