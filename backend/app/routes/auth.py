import logging
import os

import requests
from fastapi import APIRouter, HTTPException
from firebase_admin import auth
from pydantic import BaseModel

# Also guarantees firebase_admin.initialize_app() (and .env loading) has run
# before auth.create_user() below is ever called.
from app.db.firebase import db  # noqa: F401

logger = logging.getLogger(__name__)

router = APIRouter()

FIREBASE_WEB_API_KEY = os.environ["FIREBASE_WEB_API_KEY"]
IDENTITY_TOOLKIT_URL = "https://identitytoolkit.googleapis.com/v1/accounts"

GENERIC_ERROR_DETAIL = "Something went wrong. Please try again."

# Identity Toolkit error codes we recognize and want to surface with a
# friendlier message than "Invalid email or password".
IDENTITY_TOOLKIT_ERROR_MESSAGES = {
    "INVALID_EMAIL": "That email address doesn't look valid.",
    "USER_DISABLED": "This account has been disabled.",
    "TOO_MANY_ATTEMPTS_TRY_LATER": "Too many attempts. Please wait a moment and try again.",
}


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
        # Raised by the Admin SDK for malformed input (bad email format,
        # password too short, etc). These messages are already user-safe.
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Unexpected error during signup for %s", body.email)
        raise HTTPException(status_code=500, detail=GENERIC_ERROR_DETAIL)

    return {"id": user.uid, "email": user.email}


@router.post("/login")
def login(body: LoginRequest):
    # The Admin SDK can create/manage users but can't verify a password - that
    # requires Firebase's own Identity Toolkit REST endpoint.
    try:
        res = requests.post(
            f"{IDENTITY_TOOLKIT_URL}:signInWithPassword",
            params={"key": FIREBASE_WEB_API_KEY},
            json={"email": body.email, "password": body.password, "returnSecureToken": True},
            timeout=10,
        )
    except requests.exceptions.RequestException:
        logger.exception("Unexpected error reaching Identity Toolkit during login for %s", body.email)
        raise HTTPException(status_code=502, detail=GENERIC_ERROR_DETAIL)

    if not res.ok:
        try:
            error_code = res.json().get("error", {}).get("message", "")
        except ValueError:
            error_code = ""
        detail = IDENTITY_TOOLKIT_ERROR_MESSAGES.get(error_code, "Invalid email or password")
        raise HTTPException(status_code=401, detail=detail)

    try:
        data = res.json()
        return {"id": data["localId"], "email": data["email"], "token": data["idToken"]}
    except (ValueError, KeyError):
        logger.exception("Unexpected response shape from Identity Toolkit during login for %s", body.email)
        raise HTTPException(status_code=502, detail=GENERIC_ERROR_DETAIL)
