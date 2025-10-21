from sqlmodel import Field, SQLModel
from typing import Optional

# This class defines the "users" table
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str
    location: Optional[str] = None 

# This class defines the "posts" table
class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    description: str
    
    # This is the "foreign key" that links a Post to a User
    user_id: int = Field(foreign_key="user.id")