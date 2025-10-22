from fastapi import FastAPI, Depends, HTTPException, status
from sqlmodel import Session, select, SQLModel
from typing import Annotated
from pydantic import BaseModel

# Import our models and helpers
from database import get_session
from models import User
from security import hash_password, verify_password
from auth import create_access_token

app = FastAPI()

# This is a Pydantic model for receiving data
# We can't just use `User` because the user sends a plain password,
# but our `User` model has a `hashed_password`
class UserCreate(SQLModel):
    email: str
    username: str
    password: str
    location: str | None = None # Use `| None` to make it optional

# This is a Pydantic model for *sending* data back
# We never want to send the `hashed_password` back to the user
class UserRead(SQLModel):
    id: int
    email: str
    username: str
    location: str | None = None

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# This is our "Hello World" route
@app.get("/")
def read_root():
    return {"Hello": "Backend"}


# This is our new Registration route
@app.post("/register", response_model=UserRead)
def register_user(
    # Get a DB session from our dependency
    session: Annotated[Session, Depends(get_session)],
    # Get the user data from the request body
    user_data: UserCreate
):
    # 1. Check if user already exists
    #    (This check should be more robust, but it's a start)
    db_user = session.exec(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    ).first()

    if db_user:
        raise HTTPException(status_code=400, detail="Email or username already exists")

    # 2. Hash the new user's password
    hashed_pass = hash_password(user_data.password)

    # 3. Create a new User object from our models
    #    We use .model_dump() to get the data from the input
    new_user = User.model_validate(user_data, update={"hashed_password": hashed_pass})
    
    # 4. Add the user to the session and commit
    session.add(new_user)
    session.commit()
    session.refresh(new_user) # Get the new ID from the DB

    # 5. Return the newly created user (as a UserRead model)
    return new_user

@app.post("/login", response_model=Token) # <-- USE THE TOKEN RESPONSE MODEL
def login_user(
    session: Annotated[Session, Depends(get_session)],
    login_info: UserLogin
):
    user = session.exec(
        select(User).where(User.email == login_info.email)
    ).first()

    if not user or not verify_password(login_info.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, # Use a 401 status for bad logins
            detail="Incorrect email or password",
        )

    # --- This is the new part ---
    # Create the data "payload" for our token
    token_data = {"user_id": user.id, "username": user.username}
    
    # Create the token
    access_token = create_access_token(data=token_data)

    # Return the token in our Token response model
    return Token(access_token=access_token)
    