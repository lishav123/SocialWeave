import shutil
from pathlib import Path
from typing import Annotated, List

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
)
from pydantic import BaseModel
from sqlmodel import Session, select, SQLModel

# --- Import Our App Modules ---
from database import get_session
from models import User, Post, Comment, Like, Follow
from security import hash_password, verify_password
from auth import create_access_token, get_current_user

# ====================================================================
#  App Initialization & Configuration
# ====================================================================

app = FastAPI(title="SocialWeave API", description="API for the SocialWeave app")

# --- Setup Upload Directory ---
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True) # Create the folder if it doesn't exist

# ====================================================================
#  "Order Form" 📝 (Input Data Models using Pydantic/SQLModel)
# ====================================================================
# These models define the structure of data the API expects to receive.

class UserCreate(SQLModel):
    """Data required to register a new user."""
    email: str
    username: str
    password: str
    location: str | None = None

class UserLogin(BaseModel):
    """Data required for a user to log in."""
    email: str
    password: str

class PostCreate(SQLModel):
    """Data required to create a new post."""
    description: str
    media_url: str | None = None # Will be set *after* image upload

class CommentCreate(BaseModel):
    """Data required to create a new comment (can be a reply)."""
    text: str
    parent_comment_id: int | None = None # Optional ID of the comment being replied to

# ====================================================================
#  "Receipt" 🧾 (Output Data Models using Pydantic)
# ====================================================================
# These models define the structure of data the API will send back.
# They use Pydantic's BaseModel and `orm_mode` to safely read data
# from our SQLModel database objects, hiding sensitive fields like passwords.

class UserRead(BaseModel):
    """Publicly viewable user data."""
    id: int
    username: str
    location: str | None = None

    class Config:
        orm_mode = True # Allows reading data from SQLModel objects

class CommentRead(BaseModel):
    """Publicly viewable comment data, including the author."""
    id: int
    text: str
    user: UserRead # Nested user data

    class Config:
        orm_mode = True

class LikeRead(BaseModel):
    """Publicly viewable like data, showing who liked it."""
    user: UserRead # Nested user data

    class Config:
        orm_mode = True

class PostRead(BaseModel):
    """The detailed structure for returning a post, including relations."""
    id: int
    description: str
    media_url: str | None = None
    user: UserRead # Nested author data
    comments: List[CommentRead] # Nested list of comments
    likes: List[LikeRead] # Nested list of likes

    class Config:
        orm_mode = True

class Token(BaseModel):
    """Structure for returning the authentication token upon login."""
    access_token: str
    token_type: str = "bearer"

class FilePathResponse(BaseModel):
    """Structure for returning the path after a file upload."""
    file_path: str


# ====================================================================
#  API Endpoints ("Doors" 🚪)
# ====================================================================

# --- Root Endpoint ---
@app.get("/")
def read_root():
    """Simple endpoint to check if the API is running."""
    return {"message": "Welcome to the SocialWeave Backend!"}

# --- Authentication Endpoints ---
@app.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_user(
    session: Annotated[Session, Depends(get_session)],
    user_data: UserCreate
):
    """Registers a new user account."""
    # Check if email or username already exists
    existing_user = session.exec(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email or username already registered")

    # Hash the password and create the new user object
    hashed_pass = hash_password(user_data.password)
    new_user = User.model_validate(user_data, update={"hashed_password": hashed_pass})

    # Add to session, commit to DB, refresh to get ID
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user # FastAPI uses UserRead model to filter the response

@app.post("/login", response_model=Token)
def login_user(
    session: Annotated[Session, Depends(get_session)],
    login_info: UserLogin
):
    """Authenticates a user and returns a JWT access token."""
    # Find user by email
    user = session.exec(
        select(User).where(User.email == login_info.email)
    ).first()

    # Verify user exists and password is correct
    if not user or not verify_password(login_info.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}, # Standard header for auth errors
        )

    # Create token payload and generate JWT
    token_data = {"user_id": user.id, "username": user.username}
    access_token = create_access_token(data=token_data)
    return Token(access_token=access_token)

# --- User Profile & Relationship Endpoints ---
@app.get("/users/me", response_model=UserRead)
def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)] # Requires authentication
):
    """Returns the profile information for the currently logged-in user."""
    return current_user # FastAPI uses UserRead model to filter

@app.get("/users/search", response_model=List[UserRead])
def search_users(
    query: str, # Gets the search term from URL query parameter (e.g., /users/search?query=test)
    session: Annotated[Session, Depends(get_session)]
):
    """Searches for users by username (case-insensitive partial match)."""
    # Note: For production, consider adding pagination (limit/offset)
    users = session.exec(
        select(User).where(User.username.icontains(query)) # icontains = case-insensitive
    ).all()
    return users # FastAPI filters each user using UserRead

@app.post("/users/{user_id_to_follow}/follow", status_code=status.HTTP_201_CREATED)
def follow_user(
    user_id_to_follow: int, # Gets the ID from the URL path
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)] # Requires authentication
):
    """Allows the current user to follow another user."""
    if user_id_to_follow == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    # Check if user to follow exists (optional but good practice)
    user_to_follow = session.get(User, user_id_to_follow)
    if not user_to_follow:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already following (optional, DB constraint handles it but this gives a clearer message)
    existing_follow = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.followed_id == user_id_to_follow
        )
    ).first()
    if existing_follow:
         raise HTTPException(status_code=400, detail="Already following this user")


    # Create the Follow relationship object
    follow_relationship = Follow(
        follower_id=current_user.id,
        followed_id=user_id_to_follow
    )
    session.add(follow_relationship)
    session.commit()
    return {"message": f"Successfully followed user {user_id_to_follow}"}

# --- Post Creation & Interaction Endpoints (Locked 🔒) ---
@app.post("/upload/image", response_model=FilePathResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    # Requires authentication to upload images
    current_user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...) # Expects form data with a 'file' field
):
    """Handles image uploads, saves the file, and returns its relative path."""
    try:
        # Consider generating a unique filename to prevent overwrites and improve security
        # e.g., using uuid.uuid4() or user_id + timestamp
        file_location = UPLOAD_DIR / file.filename
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)

        # Return path relative to the server root (used for media_url)
        return FilePathResponse(file_path=f"/uploads/{file.filename}")
    except Exception as e:
        print(f"Error during file upload: {e}") # Log error for debugging
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {e}")
    finally:
        await file.close() # Important to close the file handle


@app.post("/posts", response_model=PostRead, status_code=status.HTTP_201_CREATED)
def create_post(
    post_data: PostCreate, # Expects description and optional media_url
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)] # Requires authentication
):
    """Creates a new post (text and optional media URL) for the logged-in user."""
    # Create the Post database object
    new_post = Post(
        description=post_data.description,
        media_url=post_data.media_url, # URL should come from /upload/image response
        user_id=current_user.id
    )

    session.add(new_post)
    session.commit()
    session.refresh(new_post) # Load relationships if needed for response
    return new_post # FastAPI filters using PostRead


@app.post("/posts/{post_id}/like", status_code=status.HTTP_200_OK) # Use 200 OK for toggle
def toggle_like_post(
    post_id: int, # From URL path
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)] # Requires authentication
):
    """Toggles the like status (likes/unlikes) for a post by the current user."""
    # Check if post exists (optional but good practice)
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Look for an existing like
    existing_like = session.exec(
        select(Like).where(
            Like.user_id == current_user.id,
            Like.post_id == post_id
        )
    ).first()

    if existing_like: # If liked, unlike it
        session.delete(existing_like)
        session.commit()
        return {"liked": False, "message": "Post unliked successfully"}
    else: # If not liked, like it
        new_like = Like(user_id=current_user.id, post_id=post_id)
        session.add(new_like)
        session.commit()
        # Change status code for creation if desired, e.g., Response(status_code=...)
        return {"liked": True, "message": "Post liked successfully"}


@app.post("/posts/{post_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
def create_comment_on_post(
    post_id: int, # From URL path
    comment_data: CommentCreate, # Expects text and optional parent_comment_id
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)] # Requires authentication
):
    """Creates a new comment (or reply) on a specific post."""
     # Check if post exists (optional but good practice)
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    # Check if parent comment exists if replying (optional but good practice)
    if comment_data.parent_comment_id:
        parent_comment = session.get(Comment, comment_data.parent_comment_id)
        if not parent_comment or parent_comment.post_id != post_id:
            raise HTTPException(status_code=400, detail="Parent comment not found or does not belong to this post")

    # Create the new Comment object
    new_comment = Comment(
        text=comment_data.text,
        user_id=current_user.id,
        post_id=post_id,
        parent_comment_id=comment_data.parent_comment_id
    )

    session.add(new_comment)
    session.commit()
    session.refresh(new_comment) # Load relationships for the response
    return new_comment # FastAPI filters using CommentRead


# --- Feed Endpoint (Locked 🔒) ---
@app.get("/feed", response_model=List[PostRead])
def get_user_feed(
    current_user: Annotated[User, Depends(get_current_user)], # Requires authentication
    session: Annotated[Session, Depends(get_session)]
):
    """Returns a list of posts for the user's feed (own posts + posts from followed users)."""
    # Get IDs of people the user follows
    following_ids = [user.id for user in current_user.following]
    # Add the user's own ID
    following_ids.append(current_user.id)

    # Fetch posts, ordered by newest first
    # Note: For production, add pagination (limit/offset)
    posts = session.exec(
        select(Post)
        .where(Post.user_id.in_(following_ids))
        .order_by(Post.id.desc())
    ).all()

    return posts # FastAPI filters using PostRead for each post in the list

# --- Static File Serving (for uploaded images) ---
# This allows the frontend to access images via URLs like http://.../uploads/image.jpg
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")