import os
from datetime import datetime, timedelta, timezone
from typing import Annotated # <-- Add this

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel

from database import get_session
from models import User
from sqlmodel import Session, select

# --- 1. Configuration ---
# This is your secret "key". In a real app, you MUST
# load this from an environment variable (e.g., os.getenv("SECRET_KEY"))
# NEVER hardcode it like this in production.
# You can generate a good key with: openssl rand -hex 32
SECRET_KEY = "thiscouldbeanythingright"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # The token will be valid for 30 minutes
bearer_scheme = HTTPBearer()

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

def get_current_user(
    session: Annotated[Session, Depends(get_session)],
    auth: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)]
):
    # This is the error we'll raise if the token is bad
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # 1. Try to decode the token
        token = auth.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 2. Extract the user_id from the token's "payload"
        user_id: int | None = payload.get("user_id")
        if user_id is None:
            raise credentials_exception # Token is bad if no user_id
            
    except JWTError:
        # If decoding fails (e.g., bad signature, expired), raise an error
        raise credentials_exception
    
    # 3. Fetch the user from the database
    user = session.get(User, user_id) # session.get() is a fast way to get by ID
    
    if user is None:
        # If the user_id from the token doesn't exist, raise an error
        raise credentials_exception
        
    # 4. Success! Return the full user object
    return user