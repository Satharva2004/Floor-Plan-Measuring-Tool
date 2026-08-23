from fastapi import APIRouter, Depends

from app.dependencies import require_pdf_owner
from app.services import cache
from app.services.extraction import extract_segments
from app.services.pdf_loader import load_page
from app.services.tick_filter import remove_tick_marks
from app.services.wall_filter import is_wall_path

router = APIRouter()


def get_segments(pdf_id: str, page_number: int):
    """Plain, unauthenticated helper - reused by the background processing
    job as well as the (auth-protected) route below."""
    cache_key = f"segments:{pdf_id}:{page_number}"
    segments = cache.get(cache_key)
    if segments is None:
        page = load_page(pdf_id, page_number)
        segments = extract_segments(page, path_filter=is_wall_path)
        segments = remove_tick_marks(segments)
        cache.set(cache_key, segments)
    return segments


@router.get("/pdfs/{pdf_id}/pages/{page_number}/segments")
def get_page_segments(pdf_id: str, page_number: int, pdf: dict = Depends(require_pdf_owner)):
    segments = get_segments(pdf_id, page_number)
    return {"pdf_id": pdf_id, "page": page_number, "segment_count": len(segments), "segments": segments}
