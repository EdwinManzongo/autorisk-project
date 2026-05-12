from fastapi import APIRouter, HTTPException, Depends
from typing import List
from database import db
from models.user import User, UserCreate, UserUpdate
from core.security import get_current_user, require_admin, hash_password

router = APIRouter(prefix="/users", tags=["users"])


_proj = {"_id": 0}


@router.get("", response_model=List[User])
async def list_users(_: User = Depends(require_admin)):
    docs = await db.users.find({}, _proj).to_list(500)
    return [User(**d) for d in docs]


@router.post("", response_model=User)
async def create_user(data: UserCreate, _: User = Depends(require_admin)):
    if await db.users.find_one({"email": data.email}, _proj):
        raise HTTPException(400, "Email already registered")
    user = User(email=data.email, full_name=data.full_name, role=data.role)
    doc = user.model_dump(mode="json")
    doc["hashed_password"] = hash_password(data.password)
    await db.users.insert_one(doc)
    return user


@router.put("/{user_id}", response_model=User)
async def update_user(user_id: str, data: UserUpdate, _: User = Depends(require_admin)):
    doc = await db.users.find_one({"id": user_id}, _proj)
    if not doc:
        raise HTTPException(404, "User not found")
    updates = {k: v for k, v in data.model_dump(exclude_none=True).items() if k != "password"}
    if data.password:
        updates["hashed_password"] = hash_password(data.password)
    await db.users.update_one({"id": user_id}, {"$set": updates})
    updated = await db.users.find_one({"id": user_id}, _proj)
    return User(**updated)


@router.delete("/{user_id}")
async def delete_user(user_id: str, current: User = Depends(require_admin)):
    if user_id == current.id:
        raise HTTPException(400, "Cannot delete your own account")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"message": "User deleted"}
