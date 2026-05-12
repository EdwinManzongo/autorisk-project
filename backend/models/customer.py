from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
import uuid
from models.enums import Gender, MaritalStatus


class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_number: str = Field(default_factory=lambda: f"CUST-{str(uuid.uuid4())[:8].upper()}")
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: str
    gender: Gender
    marital_status: MaritalStatus
    occupation: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Harare"
    country: str = "Zimbabwe"
    id_number: Optional[str] = None
    drivers_license_number: Optional[str] = None
    license_issue_date: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    class Config:
        populate_by_name = True


class CustomerCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: str
    gender: Gender
    marital_status: MaritalStatus
    occupation: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Harare"
    country: str = "Zimbabwe"
    id_number: Optional[str] = None
    drivers_license_number: Optional[str] = None
    license_issue_date: Optional[str] = None


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    occupation: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
