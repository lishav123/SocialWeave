import os
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

# --- We'll need these later for protected routes ---
# from database import get_session
# from models import User
# from sqlmodel import Session, select
# ---

# --- 1. Configuration ---
# This is your secret "key". In a real app, you MUST
# load this from an environment variable (e.g., os.getenv("SECRET_KEY"))
# NEVER hardcode it like this in production.
# You can generate a good key with: openssl rand -hex 32
SECRET_KEY = "thiscouldbeanythingright"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # The token will be valid for 30 minutes

# --- 2. Token Data Blueprint ---
# This defines what data we'll store in our token
class TokenData(BaseModel):
    username: str | None = None
    user_id: int | None = None

# --- 3. Token Creation Function ---
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    
    # Add an "expires" timestamp
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    # Create the JWT
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt