from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid
from models.enums import CoverageType, QuoteStatus, RiskLevel, PaymentFrequency


class DrivingHistory(BaseModel):
    accidents_last_5_years: int = 0
    at_fault_accidents: int = 0
    traffic_violations_last_3_years: int = 0
    dui_convictions: int = 0
    claims_last_5_years: int = 0
    license_suspensions: int = 0
    no_claims_years: int = 0
    # Telematics behavioural (monthly counts — from prototype)
    avg_monthly_mileage_km: float = 800.0
    hard_braking_events_monthly: int = 0
    speeding_incidents_monthly: int = 0
    night_driving_pct: float = 10.0   # 0–100 scale (prototype style)


class LocationRisk(BaseModel):
    city: str
    crime_rate_score: float = Field(0.3, ge=0.0, le=1.0)
    accident_prone_area: bool = False
    flood_risk_score: float = Field(0.1, ge=0.0, le=1.0)
    weather_risk_score: float = Field(0.2, ge=0.0, le=1.0)


class PolicyDetails(BaseModel):
    coverage_type: CoverageType
    sum_insured_usd: float = 20000.0          # Key input from prototype (premium base)
    deductible_usd: float = 500.0
    policy_duration_months: int = 12
    payment_frequency: PaymentFrequency = PaymentFrequency.MONTHLY
    has_previous_insurance: bool = False
    previous_insurer: Optional[str] = None
    previous_policy_lapse_months: int = 0
    no_claims_years: int = 0


class RiskBreakdown(BaseModel):
    age_risk: float
    driving_history_risk: float
    vehicle_risk: float
    location_risk: float
    behavioral_risk: float
    overall_risk_score: float
    risk_score_pct: Optional[float] = None    # 0–100 display; backfilled from overall_risk_score
    risk_level: RiskLevel
    risk_factors: List[str]
    protective_factors: List[str]

    def model_post_init(self, __context):
        if self.risk_score_pct is None:
            object.__setattr__(self, 'risk_score_pct', round(self.overall_risk_score * 100, 1))


class PremiumBreakdown(BaseModel):
    sum_insured: Optional[float] = None
    base_premium: float
    risk_adjustment: Optional[float] = None   # v2 field; old docs had risk_loading
    coverage_loading: float = 0.0
    age_experience_discount: Optional[float] = None
    safe_behaviour_discount: Optional[float] = None
    anti_theft_discount: Optional[float] = None
    ncb_discount: float = 0.0
    deductible_discount: float = 0.0
    total_annual_premium: float
    payable_premium: Optional[float] = None
    installment_label: Optional[str] = None
    monthly_premium: float = 0.0
    quarterly_premium: float = 0.0
    # Legacy v1 fields (kept Optional so old docs load without error)
    risk_loading: Optional[float] = None
    vehicle_component: Optional[float] = None
    telematics_discount: Optional[float] = None


class Quote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    quote_number: str = Field(default_factory=lambda: f"QT-{str(uuid.uuid4())[:8].upper()}")
    customer_id: str
    vehicle_id: str
    driving_history: DrivingHistory
    location_risk: LocationRisk
    policy_details: PolicyDetails
    risk_breakdown: Optional[RiskBreakdown] = None
    premium_breakdown: Optional[PremiumBreakdown] = None
    recommended_premium_usd: Optional[float] = None
    payable_premium: Optional[float] = None
    installment_label: Optional[str] = None
    gb_prediction: Optional[float] = None
    dl_prediction: Optional[float] = None
    deep_feature: Optional[float] = None
    ensemble_risk_score: Optional[float] = None
    status: QuoteStatus = QuoteStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    model_version: str = "2.0.0"

    class Config:
        populate_by_name = True


class QuoteRequest(BaseModel):
    customer_id: str
    vehicle_id: str
    driving_history: DrivingHistory
    location_risk: LocationRisk
    policy_details: PolicyDetails
    notes: Optional[str] = None
