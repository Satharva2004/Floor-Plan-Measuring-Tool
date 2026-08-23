from app.db.firebase import db
from app.routes.extract import get_segments
from app.routes.snap_points import get_snap_points


def _update(pdf_id: str, **fields):
    db.collection("pdfs").document(pdf_id).update(fields)


def process_pdf(pdf_id: str, pages: list[int]) -> None:
    """Runs as a FastAPI background task right after upload. Extracts wall
    segments and snap points for every requested page - the same work the
    segments/snap-points endpoints would otherwise do lazily on first
    request - and reports real progress onto the Firestore doc as it goes,
    so the frontend can poll actual stage/page-count rather than a fake
    timer.
    """
    try:
        total = len(pages)

        _update(pdf_id, status="processing", stage="extracting_content", pages_processed=0)
        for i, page_number in enumerate(pages, start=1):
            get_segments(pdf_id, page_number)
            _update(pdf_id, pages_processed=i)

        _update(pdf_id, stage="extracting_points", pages_processed=0)
        for i, page_number in enumerate(pages, start=1):
            get_snap_points(pdf_id, page_number)
            _update(pdf_id, pages_processed=i)

        _update(pdf_id, stage="finalizing", pages_processed=total)
        _update(pdf_id, status="ready", stage="complete")
    except Exception as exc:
        _update(pdf_id, status="error", stage="error", error=str(exc))
