from sqlmodel import Field, SQLModel, Relationship  # <-- 1. Add Relationship
from typing import Optional, List # <-- 2. Add List

# 1. Define the User model
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    location: Optional[str] = None

    # 3. Add this line:
    # This creates the "one-to-many" link from User -> Posts
    posts: List["Post"] = Relationship(back_populates="user")

# 2. Define the Post model
class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    
    user_id: int = Field(foreign_key="user.id")

    # 4. Add this line:
    # This creates the "many-to-one" link from Post -> User
    user: "User" = Relationship(back_populates="posts")