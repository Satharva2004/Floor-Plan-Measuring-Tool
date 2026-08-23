from datetime import timedelta

from fastapi import APIRouter, Depends

from app.db.firebase import bucket, db
from app.dependencies import get_current_user_id, require_pdf_owner

router = APIRouter()


@router.get("/pdfs")
def list_pdfs(user_id: str = Depends(get_current_user_id)):
    docs = [doc.to_dict() | {"id": doc.id} for doc in db.collection("pdfs").where("user_id", "==", user_id).stream()]
    docs.sort(key=lambda d: d["uploaded_at"].timestamp() if d.get("uploaded_at") else 0, reverse=True)

    return {
        "pdfs": [
            {
                "id": d["id"],
                "filename": d["filename"],
                "page_count": d["page_count"],
                "status": d.get("status", "ready"),
                "uploaded_at": d.get("uploaded_at"),
            }
            for d in docs
        ]
    }


@router.get("/pdfs/{pdf_id}")
def get_pdf(pdf: dict = Depends(require_pdf_owner)):
    url = bucket.blob(pdf["storage_path"]).generate_signed_url(expiration=timedelta(hours=1))
    return {
        "id": pdf["id"],
        "filename": pdf["filename"],
        "page_count": pdf["page_count"],
        "pages": pdf.get("pages"),
        "url": url,
        "status": pdf.get("status", "ready"),
        "stage": pdf.get("stage"),
        "pages_processed": pdf.get("pages_processed"),
        "pages_total": pdf.get("pages_total"),
        "error": pdf.get("error"),
    }
