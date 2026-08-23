import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.auth import router as auth_router
from app.routes.extract import router as extract_router
from app.routes.pdf_meta import router as pdf_meta_router
from app.routes.snap_points import router as snap_points_router
from app.routes.upload import router as upload_router

app = FastAPI(title="Plan Measuring Tool API")

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(extract_router)
app.include_router(snap_points_router)
app.include_router(pdf_meta_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
