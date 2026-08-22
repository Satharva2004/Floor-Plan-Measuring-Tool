from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.extract import router as extract_router
from app.routes.upload import router as upload_router

app = FastAPI(title="Plan Measuring Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(extract_router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
