from fastapi import Depends, Header, HTTPException
from firebase_admin import auth

# Also guarantees firebase_admin.initialize_app() (and .env loading) has run
# before auth.verify_id_token() below is ever called.
from app.db.firebase import db


def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.removeprefix("Bearer ")
    try:
        # A few seconds of tolerance for clock drift between this server and
        # Google's auth servers - without it, a token used immediately after
        # login can be spuriously rejected as "used too early".
        decoded = auth.verify_id_token(token, clock_skew_seconds=10)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return decoded["uid"]


def require_pdf_owner(pdf_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    """Loads the PDF's Firestore doc and confirms it belongs to the caller.
    Returns 404 (not 403) when it belongs to someone else, so a guessed id
    can't be used to tell "doesn't exist" from "isn't yours"."""
    doc = db.collection("pdfs").document(pdf_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="PDF not found")
    return {"id": doc.id, **doc.to_dict()}


def require_pdf_page(page_number: int, pdf: dict = Depends(require_pdf_owner)) -> dict:
    """Same ownership check as require_pdf_owner, plus: only pages the user
    actually chose at upload time are servable. Without this, a page outside
    that selection would still get computed and cached the first time
    anyone requested it - quietly processing "all" pages regardless of what
    was selected."""
    selected_pages = pdf.get("pages")
    if selected_pages is not None and page_number not in selected_pages:
        raise HTTPException(status_code=404, detail="Page not found")
    return pdf
