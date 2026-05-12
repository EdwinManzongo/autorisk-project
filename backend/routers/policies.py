from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from database import db
from models.policy import Policy, PolicyCreate, PolicyUpdate, PolicyRenew
from models.enums import PolicyStatus
from models.user import User
from core.security import get_current_user

router = APIRouter(prefix="/policies", tags=["policies"])
_proj = {"_id": 0}


@router.get("", response_model=List[Policy])
async def list_policies(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    _: User = Depends(get_current_user),
):
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if status:
        query["status"] = status
    docs = await db.policies.find(query, _proj).sort("created_at", -1).to_list(500)
    return [Policy(**d) for d in docs]


@router.get("/check-active")
async def check_active_policy(
    customer_id: str,
    vehicle_id: str,
    _: User = Depends(get_current_user),
):
    """Check whether a customer+vehicle combination already has an active policy."""
    doc = await db.policies.find_one(
        {"customer_id": customer_id, "vehicle_id": vehicle_id, "status": "active"},
        _proj,
    )
    if doc:
        return {"has_active": True, "policy_number": doc["policy_number"],
                "end_date": doc["end_date"], "policy_id": doc["id"]}
    return {"has_active": False}


@router.get("/{policy_id}", response_model=Policy)
async def get_policy(policy_id: str, _: User = Depends(get_current_user)):
    doc = await db.policies.find_one({"id": policy_id}, _proj)
    if not doc:
        raise HTTPException(404, "Policy not found")
    return Policy(**doc)


@router.post("", response_model=Policy)
async def create_policy(data: PolicyCreate, current: User = Depends(get_current_user)):
    # Guard: block if customer already has an active policy for this vehicle
    active = await db.policies.find_one(
        {"customer_id": data.customer_id, "vehicle_id": data.vehicle_id, "status": "active"},
        _proj,
    )
    if active:
        raise HTTPException(
            409,
            f"Client already has active policy {active['policy_number']} "
            f"(expires {active['end_date']}). Cancel or renew it instead of creating a new one.",
        )

    quote_doc = await db.quotes.find_one({"id": data.quote_id}, _proj)
    if not quote_doc:
        raise HTTPException(404, "Quote not found")

    policy = Policy(**data.model_dump(), created_by=current.id)
    await db.policies.insert_one(policy.model_dump(mode="json"))
    await db.quotes.update_one({"id": data.quote_id}, {"$set": {"status": "accepted"}})
    return policy


@router.put("/{policy_id}", response_model=Policy)
async def update_policy(
    policy_id: str,
    data: PolicyUpdate,
    _: User = Depends(get_current_user),
):
    doc = await db.policies.find_one({"id": policy_id}, _proj)
    if not doc:
        raise HTTPException(404, "Policy not found")
    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    await db.policies.update_one({"id": policy_id}, {"$set": updates})
    updated = await db.policies.find_one({"id": policy_id}, _proj)
    return Policy(**updated)


@router.post("/{policy_id}/renew", response_model=Policy)
async def renew_policy(
    policy_id: str,
    data: PolicyRenew,
    current: User = Depends(get_current_user),
):
    """
    Renew a policy:
    - Creates a new policy with fresh dates and optional new premium.
    - Marks the previous policy as 'expired'.
    - Blocks renewal if another active policy already exists for the same vehicle.
    """
    existing = await db.policies.find_one({"id": policy_id}, _proj)
    if not existing:
        raise HTTPException(404, "Policy not found")

    # Block if a *different* active policy already covers this vehicle
    other_active = await db.policies.find_one(
        {"customer_id": existing["customer_id"], "vehicle_id": existing["vehicle_id"],
         "status": "active", "id": {"$ne": policy_id}},
        _proj,
    )
    if other_active:
        raise HTTPException(
            409,
            f"Another active policy {other_active['policy_number']} already exists "
            f"for this vehicle (expires {other_active['end_date']}). Cancel it first.",
        )

    new_premium = data.annual_premium_usd if data.annual_premium_usd else existing["annual_premium_usd"]
    renewal_note = f"Renewal of {existing['policy_number']}."
    if data.notes:
        renewal_note = f"{renewal_note} {data.notes}"

    renewal = Policy(
        quote_id=existing["quote_id"],
        customer_id=existing["customer_id"],
        vehicle_id=existing["vehicle_id"],
        coverage_type=existing["coverage_type"],
        annual_premium_usd=new_premium,
        deductible_usd=existing["deductible_usd"],
        start_date=data.start_date,
        end_date=data.end_date,
        status=PolicyStatus.ACTIVE,
        payment_frequency=existing.get("payment_frequency", "annual"),
        notes=renewal_note,
        renewed_from=existing["policy_number"],
        renewal_count=(existing.get("renewal_count") or 0) + 1,
        created_by=current.id,
    )
    await db.policies.insert_one(renewal.model_dump(mode="json"))

    # Mark the previous policy as expired
    await db.policies.update_one({"id": policy_id}, {"$set": {"status": "expired"}})

    return renewal
