import os

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore, storage

load_dotenv()

cred = credentials.Certificate(
    {
        "type": os.environ["TYPE"],
        "project_id": os.environ["PROJECT_ID"],
        "private_key_id": os.environ["PRIVATE_KEY_ID"],
        "private_key": os.environ["PRIVATE_KEY"].replace("\\n", "\n"),
        "client_email": os.environ["CLIENT_EMAIL"],
        "client_id": os.environ["CLIENT_ID"],
        "auth_uri": os.environ["AUTH_URI"],
        "token_uri": os.environ["TOKEN_URI"],
        "auth_provider_x509_cert_url": os.environ["AUTH_PROVIDER_X509_CERT_URL"],
        "client_x509_cert_url": os.environ["CLIENT_X509_CERT_URL"],
    }
)

firebase_admin.initialize_app(cred, {"storageBucket": os.environ["STORAGE_BUCKET"]})

db = firestore.client()
bucket = storage.bucket()
