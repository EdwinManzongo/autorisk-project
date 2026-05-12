from fastapi import APIRouter, HTTPException
from database import db
from models.user import User, UserCreate, UserLogin, Token
from core.security import verify_password, create_access_token, hash_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(data: UserLogin):
    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user_doc or not verify_password(data.password, user_doc.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = User(**user_doc)
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    token = create_access_token({"sub": user.id, "role": user.role})
    return Token(access_token=token, token_type="bearer", user=user.model_dump(mode="json"))
