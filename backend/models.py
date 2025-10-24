from typing import List, Optional
from sqlmodel import Field, SQLModel, Relationship

# ====================================================================
#  "Join Table" 🤝 for Followers (User <-> User)
# ====================================================================
# This table's only job is to link two Users together.
# It creates a "many-to-many" relationship.
class Follow(SQLModel, table=True):
    # The ID of the user *doing* the following
    follower_id: int | None = Field(
        default=None, foreign_key="user.id", primary_key=True
    )
    # The ID of the user *being* followed
    followed_id: int | None = Field(
        default=None, foreign_key="user.id", primary_key=True
    )

# ====================================================================
#  "Join Table" 🤝 for Likes (User <-> Post)
# ====================================================================
# This table links a User to a Post.
# (Inside models.py)
# Make sure Relationship is imported from sqlmodel

class Like(SQLModel, table=True):
    # --- Foreign Keys (The "links") ---
    user_id: int | None = Field(
        default=None, foreign_key="user.id", primary_key=True
    )
    post_id: int | None = Field(
        default=None, foreign_key="post.id", primary_key=True
    )

    # --- Relationships (The "Python objects") ---
    # Add these two new lines:
    user: "User" = Relationship(back_populates="likes")
    post: "Post" = Relationship(back_populates="likes")
    
# ====================================================================
#  Core Model: User 🧑
# ====================================================================
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    location: Optional[str] = None

    # --- Relationships ---

    # "One-to-Many" (User -> Posts)
    # One User can have many Posts.
    posts: List["Post"] = Relationship(back_populates="user")
    
    # "One-to-Many" (User -> Comments)
    # One User can write many Comments.
    comments: List["Comment"] = Relationship(back_populates="user")
    
    # "One-to-Many" (User -> Likes)
    # One User can give many Likes.
    likes: List["Like"] = Relationship(back_populates="user")

    # "Many-to-Many" (User <-> Users)
    # A User can follow many other Users.
    following: List["User"] = Relationship(
        link_model=Follow, # Use the "Follow" table as the bridge
        sa_relationship_kwargs={
            "primaryjoin": "User.id==Follow.follower_id",
            "secondaryjoin": "User.id==Follow.followed_id",
        },
    )

    # "Many-to-Many" (User <-> Users)
    # A User can be followed by many other Users.
    followers: List["User"] = Relationship(
        link_model=Follow, # Use the "Follow" table as the bridge
        sa_relationship_kwargs={
            "primaryjoin": "User.id==Follow.followed_id",
            "secondaryjoin": "User.id==Follow.follower_id",
        },
    )

# ====================================================================
#  Core Model: Post 🖼️
# ====================================================================
class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    media_url: str | None = None
    # We'll add media_url here later!
    
    # --- Foreign Keys (The "link") ---
    
    # "Many-to-One" (Post -> User)
    # This is the *column* that stores which user made the post.
    user_id: int = Field(foreign_key="user.id")

    # --- Relationships ---

    # This is the *Python object* that links to the User.
    user: "User" = Relationship(back_populates="posts")

    # "One-to-Many" (Post -> Comments)
    # One Post can have many Comments.
    comments: List["Comment"] = Relationship(back_populates="post")
    
    # "One-to-Many" (Post -> Likes)
    # One Post can have many Likes.
    likes: List["Like"] = Relationship(back_populates="post")


# ====================================================================
#  Core Model: Comment 💬
# ====================================================================
class Comment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    text: str
    
    # --- Foreign Keys (The "links") ---
    user_id: int = Field(foreign_key="user.id") # Who wrote it
    post_id: int = Field(foreign_key="post.id") # What post it's on

    # --- Relationships ---
    user: "User" = Relationship(back_populates="comments")
    post: "Post" = Relationship(back_populates="comments")