from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class TelematicsRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vehicle_id: Optional[str] = None
    customer_id: Optional[str] = None
    registration_number: str
    customer_name: Optional[str] = None
    period_month: str                          # "YYYY-MM"
    avg_monthly_mileage_km: float = 800.0      # 50–5000
    hard_braking_events_monthly: int = 0       # 0–20
    speeding_incidents_monthly: int = 0        # 0–10
    night_driving_pct: float = 10.0            # 0–100
    notes: Optional[str] = None
    uploaded_by: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    source: str = "excel_upload"

    class Config:
        populate_by_name = True


class TelematicsCreate(BaseModel):
    registration_number: str
    customer_name: Optional[str] = None
    period_month: str
    avg_monthly_mileage_km: float = 800.0
    hard_braking_events_monthly: int = 0
    speeding_incidents_monthly: int = 0
    night_driving_pct: float = 10.0
    notes: Optional[str] = None
