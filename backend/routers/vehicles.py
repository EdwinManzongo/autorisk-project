from fastapi import APIRouter, HTTPException, Depends
from typing import List
from database import db
from models.vehicle import Vehicle, VehicleCreate, VehicleUpdate
from models.user import User
from core.security import get_current_user

router = APIRouter(prefix="/vehicles", tags=["vehicles"])
_proj = {"_id": 0}


@router.get("", response_model=List[Vehicle])
async def list_vehicles(_: User = Depends(get_current_user)):
    docs = await db.vehicles.find({}, _proj).sort("created_at", -1).to_list(500)
    return [Vehicle(**d) for d in docs]


@router.get("/customer/{customer_id}", response_model=List[Vehicle])
async def get_customer_vehicles(customer_id: str, _: User = Depends(get_current_user)):
    docs = await db.vehicles.find({"customer_id": customer_id}, _proj).to_list(100)
    return [Vehicle(**d) for d in docs]


@router.get("/{vehicle_id}", response_model=Vehicle)
async def get_vehicle(vehicle_id: str, _: User = Depends(get_current_user)):
    doc = await db.vehicles.find_one({"id": vehicle_id}, _proj)
    if not doc:
        raise HTTPException(404, "Vehicle not found")
    return Vehicle(**doc)


@router.post("", response_model=Vehicle)
async def create_vehicle(data: VehicleCreate, _: User = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": data.customer_id}, _proj)
    if not customer:
        raise HTTPException(404, "Customer not found")
    vehicle = Vehicle(**data.model_dump())
    await db.vehicles.insert_one(vehicle.model_dump(mode="json"))
    return vehicle


@router.put("/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(
    vehicle_id: str,
    data: VehicleUpdate,
    _: User = Depends(get_current_user),
):
    doc = await db.vehicles.find_one({"id": vehicle_id}, _proj)
    if not doc:
        raise HTTPException(404, "Vehicle not found")
    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": updates})
    updated = await db.vehicles.find_one({"id": vehicle_id}, _proj)
    return Vehicle(**updated)


@router.delete("/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, _: User = Depends(get_current_user)):
    result = await db.vehicles.delete_one({"id": vehicle_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Vehicle not found")
    return {"message": "Vehicle deleted"}
