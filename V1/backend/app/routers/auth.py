from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, Token, GoogleLogin, AuthConfig
from app.core.security import create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

def verify_google_token(credential: str) -> dict:
    """Verify a Google ID token's signature, audience and expiry. Returns its claims."""
    return google_id_token.verify_oauth2_token(
        credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
    )

def issue_token(user: User, db: Session) -> dict:
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/config", response_model=AuthConfig)
def get_auth_config():
    return {"google_client_id": settings.GOOGLE_CLIENT_ID}

@router.post("/google", response_model=Token)
def google_login(login_in: GoogleLogin, db: Session = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google login is not configured on the server (GOOGLE_CLIENT_ID is empty)."
        )
    try:
        claims = verify_google_token(login_in.credential)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential.")

    if not claims.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google email is not verified.")

    email = claims["email"].lower()
    is_admin_email = email in settings.admin_emails
    user = db.query(User).filter(User.email == email).first()

    if user is None:
        if not is_admin_email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You have not been invited to GIP_CodeZ. Ask your admin for an invite."
            )
        user = User(name=claims.get("name") or email, email=email, role="admin")
        db.add(user)
    elif user.google_sub and user.google_sub != claims["sub"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account mismatch for this email.")

    if is_admin_email:
        user.role = "admin"
    user.google_sub = claims["sub"]
    user.name = claims.get("name") or user.name
    user.avatar_url = claims.get("picture")
    user.status = "active"
    return issue_token(user, db)

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
