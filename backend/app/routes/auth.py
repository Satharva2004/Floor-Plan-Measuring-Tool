import os

import requests
from fastapi import APIRouter, HTTPException
from firebase_admin import auth
from pydantic import BaseModel

# Also guarantees firebase_admin.initialize_app() (and .env loading) has run
# before auth.create_user() below is ever called.
from app.db.firebase import db  # noqa: F401

router = APIRouter()

FIREBASE_WEB_API_KEY = os.environ["FIREBASE_WEB_API_KEY"]
IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1/accounts"


class SignupRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/signup")
def signup(body: SignupRequest):
    """Creates the user in Firebase Authentication - its own namespace, entirely
    separate from the Firestore "pdfs" collection the rest of the app uses."""
    try:
        user = auth.create_user(email=body.email, password=body.password)
    except auth.EmailAlreadyExistsError:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"id": user.uid, "email": user.email}


@router.post("/login")
def login(body: LoginRequest):
    # The Admin SDK can create/manage users but can't verify a password - that
    # requires Firebase's own Identity Toolkit REST endpoint.
    res = requests.post(
        f"{IDENTITY_TOOLKIT_URL}:signInWithPassword",
        params={"key": FIREBASE_WEB_API_KEY},
        json={"email": body.email, "password": body.password, "returnSecureToken": True},
    )
    if not res.ok:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    data = res.json()
    return {"id": data["localId"], "email": data["email"], "token": data["idToken"]}
