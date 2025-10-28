from fastapi import FastAPI, Depends, HTTPException, status
from sqlmodel import Session, select, SQLModel
from typing import Annotated, List
from pydantic import BaseModel

# --- Import Our App Modules ---
from database import get_session
from models import User, Post, Comment, Like, Follow
from security import hash_password, verify_password
from auth import create_access_token, get_current_user

# ====================================================================
#  App Initialization
# ====================================================================

app = FastAPI()

# ====================================================================
#  "Order Form" 📝 (Input Models)
# ====================================================================

class UserCreate(SQLModel):
    """Data needed to create a new user."""
    email: str
    username: str
    password: str
    location: str | None = None

class UserLogin(BaseModel):
    """Data needed for a user to log in."""
    email: str
    password: str

class PostCreate(SQLModel):
    """Data needed to create a new post."""
    description: str
    media_url: str | None = None

# ====================================================================
#  "Receipt" 🧾 (Output Models)
# ====================================================================

# We use BaseModel and `orm_mode` to create "receipts"
# that safely read data from our SQLModel objects.

class UserRead(BaseModel):
    """Public data for a User (hides password)."""
    id: int
    username: str
    location: str | None = None
    
    class Config:
        orm_mode = True

class CommentRead(BaseModel):
    """Public data for a Comment."""
    id: int
    text: str
    user: UserRead  # Nests the user who wrote the comment
    
    class Config:
        orm_mode = True

class LikeRead(BaseModel):
    """Public data for a Like."""
    user: UserRead # Nests the user who liked the post
    
    class Config:
        orm_mode = True

class PostRead(BaseModel):
    """The "Master Receipt" for a single Post."""
    id: int
    description: str
    media_url: str | None = None
    
    user: UserRead               # Nests the author
    comments: List[CommentRead]  # Nests a LIST of comments
    likes: List[LikeRead]        # Nests a LIST of likes

    class Config:
        orm_mode = True

class Token(BaseModel):
    """The "Receipt" for a successful login."""
    access_token: str
    token_type: str = "bearer"

class CommentCreate(BaseModel):
    """Data needed to create a new comment."""
    text: str
    parent_comment_id: int | None = None

# ====================================================================
#  API Endpoints ("Doors" 🚪)
# ====================================================================

@app.get("/")
def read_root():
    return {"Hello": "Backend"}

# --- Auth Doors ---

@app.post("/register", response_model=UserRead)
def register_user(
    session: Annotated[Session, Depends(get_session)],
    user_data: UserCreate
):
    """Creates a new user in the database."""
    db_user = session.exec(
        select(User).where(
            (User.email == user_data.email) | (User.username == user_data.username)
        )
    ).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email or username already exists")

    hashed_pass = hash_password(user_data.password)
    new_user = User.model_validate(user_data, update={"hashed_password": hashed_pass})
    
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user

@app.post("/login", response_model=Token)
def login_user(
    session: Annotated[Session, Depends(get_session)],
    login_info: UserLogin
):
    """Logs a user in by verifying credentials and returning a JWT."""
    user = session.exec(
        select(User).where(User.email == login_info.email)
    ).first()

    if not user or not verify_password(login_info.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token_data = {"user_id": user.id, "username": user.username}
    access_token = create_access_token(data=token_data)
    return Token(access_token=access_token)

# --- User Doors ---

@app.get("/users/search", response_model=List[UserRead])
def search_users(
    query: str,
    session: Annotated[Session, Depends(get_session)]
):
    """Finds users whose username contains the query string."""
    users = session.exec(
        select(User).where(User.username.contains(query))
    ).all()
    return users

@app.post("/users/{user_id_to_follow}/follow", status_code=status.HTTP_201_CREATED)
def follow_user(
    user_id_to_follow: int,
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    """Creates a "Follow" relationship between the current user and another user."""
    if user_id_to_follow == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Cannot follow yourself"
        )

    follow_relationship = Follow(
        follower_id=current_user.id,
        followed_id=user_id_to_follow
    )
    session.add(follow_relationship)
    session.commit()
    return {"message": f"Successfully followed user {user_id_to_follow}"}

# --- Post & Feed Doors (Locked 🔒) ---

@app.post("/posts", response_model=PostRead, status_code=status.HTTP_201_CREATED)
def create_post(
    post_data: PostCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)]
):
    """Creates a new post as the currently logged-in user."""
    new_post = Post(
        description=post_data.description,
        media_url=post_data.media_url,
        user_id=current_user.id
    )
    
    session.add(new_post)
    session.commit()
    session.refresh(new_post)
    return new_post

@app.get("/feed", response_model=List[PostRead])
def get_user_feed(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)]
):
    """Gets the feed for the current user (posts from people they follow + their own)."""
    following_ids = [user.id for user in current_user.following]
    following_ids.append(current_user.id) 

    posts = session.exec(
        select(Post)
        .where(Post.user_id.in_(following_ids))
        .order_by(Post.id.desc()) # Get newest posts first
    ).all()
    
    return posts

@app.post("/posts/{post_id}/like", status_code=status.HTTP_201_CREATED)
def toggle_like_post(
    post_id: int,
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    """Likes or unlikes a post for the current user."""
    
    # 1. Look for an existing like by this user on this post
    existing_like = session.exec(
        select(Like).where(
            Like.user_id == current_user.id,
            Like.post_id == post_id
        )
    ).first()

    # 2. If the like exists, delete it (unlike)
    if existing_like:
        session.delete(existing_like)
        session.commit()
        return {"message": "Post unliked successfully"}
    
    # 3. If the like does *not* exist, create it (like)
    else:
        new_like = Like(user_id=current_user.id, post_id=post_id)
        session.add(new_like)
        session.commit()
        # We return 201 Created by default, but change it if needed
        # Or return the new_like object if the frontend needs it
        return {"message": "Post liked successfully"}

# (In main.py)
# Add this endpoint, usually near your other user-related routes

@app.get("/users/me", response_model=UserRead)
def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)]
):
    """Gets the profile for the currently logged-in user."""
    return current_user

@app.post("/posts/{post_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
def create_comment_on_post(
    post_id: int,
    comment_data: CommentCreate, # Our new "order form" 📝
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[User, Depends(get_current_user)]
):
    """Creates a new comment on a specific post for the current user."""

    # 1. Create the new Comment object
    new_comment = Comment(
        text=comment_data.text,
        user_id=current_user.id,
        post_id=post_id,
        parent_comment_id=comment_data.parent_comment_id # <-- ADD THIS
    )

    # 2. Add, commit, and refresh
    session.add(new_comment)
    session.commit()
    session.refresh(new_comment)

    # 3. Return the new comment (FastAPI filters using CommentRead)
    return new_comment