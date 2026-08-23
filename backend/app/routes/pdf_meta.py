from datetime import timedelta

from fastapi import APIRouter, HTTPException

from app.db.firebase import bucket, db

router = APIRouter()


@router.get("/pdfs/{pdf_id}")
def get_pdf(pdf_id: str):
    doc = db.collection("pdfs").document(pdf_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="PDF not found")

    data = doc.to_dict()
    url = bucket.blob(data["storage_path"]).generate_signed_url(expiration=timedelta(hours=1))

    return {"id": pdf_id, "filename": data["filename"], "page_count": data["page_count"], "url": url}
