from fastapi import APIRouter, Depends

from app.dependencies import require_pdf_page
from app.routes.extract import get_segments
from app.services import cache
from app.services.snap_points import generate_snap_points

router = APIRouter()


def get_snap_points(pdf_id: str, page_number: int):
    """Plain, unauthenticated helper - reused by the background processing
    job as well as the (auth-protected) route below."""
    cache_key = f"snap_points:{pdf_id}:{page_number}"
    points = cache.get(cache_key)
    if points is None:
        segments = get_segments(pdf_id, page_number)
        points = generate_snap_points(segments)
        cache.set(cache_key, points)
    return points


@router.get("/pdfs/{pdf_id}/pages/{page_number}/snap-points")
def get_page_snap_points(pdf_id: str, page_number: int, pdf: dict = Depends(require_pdf_page)):
    points = get_snap_points(pdf_id, page_number)
    return {"pdf_id": pdf_id, "page": page_number, "point_count": len(points), "points": points}
