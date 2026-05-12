from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    UNDERWRITER = "underwriter"
    AGENT = "agent"


class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class MaritalStatus(str, Enum):
    SINGLE = "single"
    MARRIED = "married"
    DIVORCED = "divorced"
    WIDOWED = "widowed"


class CoverageType(str, Enum):
    THIRD_PARTY = "third_party"
    THIRD_PARTY_FIRE_THEFT = "third_party_fire_theft"
    COMPREHENSIVE = "comprehensive"
    FULL_COMPREHENSIVE = "full_comprehensive"


class UsageType(str, Enum):
    PERSONAL = "personal"
    COMMUTE = "commute"
    BUSINESS = "business"
    COMMERCIAL = "commercial"


class PolicyStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    SUSPENDED = "suspended"


class QuoteStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class EngineType(str, Enum):
    PETROL = "petrol"
    DIESEL = "diesel"
    EV = "ev"
    CNG = "cng"
    HYBRID = "hybrid"


class PaymentFrequency(str, Enum):
    MONTHLY = "monthly"
    TERMLY = "termly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"
