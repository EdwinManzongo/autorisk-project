from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from database import db
from models.customer import Customer, CustomerCreate, CustomerUpdate
from models.user import User
from core.security import get_current_user

router = APIRouter(prefix="/customers", tags=["customers"])
_proj = {"_id": 0}


@router.get("", response_model=List[Customer])
async def list_customers(
    search: Optional[str] = None,
    _: User = Depends(get_current_user),
):
    query = {}
    if search:
        query = {
            "$or": [
                {"first_name": {"$regex": search, "$options": "i"}},
                {"last_name": {"$regex": search, "$options": "i"}},
                {"customer_number": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}},
            ]
        }
    docs = await db.customers.find(query, _proj).sort("created_at", -1).to_list(500)
    return [Customer(**d) for d in docs]


@router.get("/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, _: User = Depends(get_current_user)):
    doc = await db.customers.find_one({"id": customer_id}, _proj)
    if not doc:
        raise HTTPException(404, "Customer not found")
    return Customer(**doc)


@router.post("", response_model=Customer)
async def create_customer(data: CustomerCreate, current: User = Depends(get_current_user)):
    customer = Customer(**data.model_dump(), created_by=current.id)
    await db.customers.insert_one(customer.model_dump(mode="json"))
    return customer


@router.put("/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    _: User = Depends(get_current_user),
):
    doc = await db.customers.find_one({"id": customer_id}, _proj)
    if not doc:
        raise HTTPException(404, "Customer not found")
    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    await db.customers.update_one({"id": customer_id}, {"$set": updates})
    updated = await db.customers.find_one({"id": customer_id}, _proj)
    return Customer(**updated)


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str, _: User = Depends(get_current_user)):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Customer not found")
    return {"message": "Customer deleted"}
