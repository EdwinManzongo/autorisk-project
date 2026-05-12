from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid
from models.enums import PolicyStatus, CoverageType


class Policy(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    policy_number: str = Field(default_factory=lambda: f"POL-{str(uuid.uuid4())[:8].upper()}")
    quote_id: str
    customer_id: str
    vehicle_id: str
    coverage_type: CoverageType
    annual_premium_usd: float
    deductible_usd: float
    start_date: str
    end_date: str
    status: PolicyStatus = PolicyStatus.ACTIVE
    payment_frequency: str = "annual"
    notes: Optional[str] = None
    renewed_from: Optional[str] = None    # policy_number of the predecessor
    renewal_count: int = 0                # how many times this policy has been renewed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    class Config:
        populate_by_name = True


class PolicyCreate(BaseModel):
    quote_id: str
    customer_id: str
    vehicle_id: str
    coverage_type: CoverageType
    annual_premium_usd: float
    deductible_usd: float
    start_date: str
    end_date: str
    payment_frequency: str = "annual"
    notes: Optional[str] = None


class PolicyUpdate(BaseModel):
    status: Optional[PolicyStatus] = None
    notes: Optional[str] = None
    annual_premium_usd: Optional[float] = None


class PolicyRenew(BaseModel):
    start_date: str
    end_date: str
    annual_premium_usd: Optional[float] = None   # defaults to existing premium
    notes: Optional[str] = None
