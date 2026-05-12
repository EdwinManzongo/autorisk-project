from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid
from models.enums import UsageType, EngineType


class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    registration_number: str
    make: str
    model: str
    year: int
    engine_size_cc: int
    vehicle_value_usd: float
    color: Optional[str] = None
    chassis_number: Optional[str] = None
    engine_number: Optional[str] = None
    engine_type: EngineType = EngineType.PETROL
    usage_type: UsageType = UsageType.PERSONAL
    annual_mileage_km: int = 15000
    safety_features: List[str] = Field(default_factory=list)
    modifications: Optional[str] = None
    garage_kept: bool = True
    financed: bool = False
    anti_theft: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class VehicleCreate(BaseModel):
    customer_id: str
    registration_number: str
    make: str
    model: str
    year: int
    engine_size_cc: int
    vehicle_value_usd: float
    color: Optional[str] = None
    chassis_number: Optional[str] = None
    engine_number: Optional[str] = None
    engine_type: EngineType = EngineType.PETROL
    usage_type: UsageType = UsageType.PERSONAL
    annual_mileage_km: int = 15000
    safety_features: List[str] = Field(default_factory=list)
    modifications: Optional[str] = None
    garage_kept: bool = True
    financed: bool = False
    anti_theft: bool = False


class VehicleUpdate(BaseModel):
    vehicle_value_usd: Optional[float] = None
    engine_type: Optional[EngineType] = None
    usage_type: Optional[UsageType] = None
    annual_mileage_km: Optional[int] = None
    safety_features: Optional[List[str]] = None
    garage_kept: Optional[bool] = None
    anti_theft: Optional[bool] = None
