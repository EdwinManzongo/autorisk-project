from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timedelta
from database import db
from models.quote import Quote, QuoteRequest, RiskBreakdown, PremiumBreakdown
from models.user import User
from core.security import get_current_user
from ml.risk_engine import get_risk_engine

router = APIRouter(prefix="/quotes", tags=["quotes"])
_proj = {"_id": 0}


async def _run_calculation(data: QuoteRequest, current_user_id: str):
    """Shared calculation logic used by create and recalculate."""
    customer_doc = await db.customers.find_one({"id": data.customer_id}, _proj)
    if not customer_doc:
        raise HTTPException(404, "Customer not found")
    vehicle_doc = await db.vehicles.find_one({"id": data.vehicle_id}, _proj)
    if not vehicle_doc:
        raise HTTPException(404, "Vehicle not found")

    engine_input = {
        "customer":        customer_doc,
        "vehicle":         vehicle_doc,
        "driving_history": data.driving_history.model_dump(mode="json"),
        "location_risk":   data.location_risk.model_dump(mode="json"),
        "policy_details":  data.policy_details.model_dump(mode="json"),
    }
    return get_risk_engine().calculate_premium(engine_input)


@router.post("/calculate", response_model=Quote)
async def calculate_quote(data: QuoteRequest, current: User = Depends(get_current_user)):
    result = await _run_calculation(data, current.id)

    quote = Quote(
        customer_id=data.customer_id,
        vehicle_id=data.vehicle_id,
        driving_history=data.driving_history,
        location_risk=data.location_risk,
        policy_details=data.policy_details,
        risk_breakdown=RiskBreakdown(**result["risk_breakdown"]),
        premium_breakdown=PremiumBreakdown(**result["premium_breakdown"]),
        recommended_premium_usd=result["recommended_premium_usd"],
        payable_premium=result["payable_premium"],
        installment_label=result["installment_label"],
        gb_prediction=result["gb_prediction"],
        dl_prediction=result["dl_prediction"],
        deep_feature=result["deep_feature"],
        ensemble_risk_score=result["ensemble_risk_score"],
        created_by=current.id,
        valid_until=datetime.utcnow() + timedelta(days=30),
        notes=data.notes,
    )
    await db.quotes.insert_one(quote.model_dump(mode="json"))
    return quote


@router.get("", response_model=List[Quote])
async def list_quotes(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    _: User = Depends(get_current_user),
):
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if status:
        query["status"] = status
    docs = await db.quotes.find(query, _proj).sort("created_at", -1).to_list(500)
    return [Quote(**d) for d in docs]


@router.get("/model/stats")
async def model_stats(_: User = Depends(get_current_user)):
    return get_risk_engine().get_model_stats()


@router.get("/{quote_id}", response_model=Quote)
async def get_quote(quote_id: str, _: User = Depends(get_current_user)):
    doc = await db.quotes.find_one({"id": quote_id}, _proj)
    if not doc:
        raise HTTPException(404, "Quote not found")
    return Quote(**doc)


@router.put("/{quote_id}/accept")
async def accept_quote(quote_id: str, _: User = Depends(get_current_user)):
    if not await db.quotes.find_one({"id": quote_id}, _proj):
        raise HTTPException(404, "Quote not found")
    await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "accepted"}})
    return {"message": "Quote accepted"}


@router.put("/{quote_id}/reject")
async def reject_quote(quote_id: str, _: User = Depends(get_current_user)):
    if not await db.quotes.find_one({"id": quote_id}, _proj):
        raise HTTPException(404, "Quote not found")
    await db.quotes.update_one({"id": quote_id}, {"$set": {"status": "rejected"}})
    return {"message": "Quote rejected"}


@router.put("/{quote_id}/recalculate", response_model=Quote)
async def recalculate_quote(
    quote_id: str,
    data: QuoteRequest,
    current: User = Depends(get_current_user),
):
    """Update an existing quote in place with new inputs and re-run the AI engine."""
    existing = await db.quotes.find_one({"id": quote_id}, _proj)
    if not existing:
        raise HTTPException(404, "Quote not found")

    result = await _run_calculation(data, current.id)

    updates = {
        "driving_history":         data.driving_history.model_dump(mode="json"),
        "location_risk":           data.location_risk.model_dump(mode="json"),
        "policy_details":          data.policy_details.model_dump(mode="json"),
        "risk_breakdown":          result["risk_breakdown"],
        "premium_breakdown":       result["premium_breakdown"],
        "recommended_premium_usd": result["recommended_premium_usd"],
        "payable_premium":         result["payable_premium"],
        "installment_label":       result["installment_label"],
        "gb_prediction":           result["gb_prediction"],
        "dl_prediction":           result["dl_prediction"],
        "deep_feature":            result["deep_feature"],
        "ensemble_risk_score":     result["ensemble_risk_score"],
        "status":                  "pending",
        "valid_until":             (datetime.utcnow() + timedelta(days=30)).isoformat(),
        "notes":                   data.notes if data.notes is not None else existing.get("notes"),
        "model_version":           "2.0.0",
    }
    await db.quotes.update_one({"id": quote_id}, {"$set": updates})
    updated = await db.quotes.find_one({"id": quote_id}, _proj)
    return Quote(**updated)


@router.delete("/{quote_id}")
async def delete_quote(quote_id: str, _: User = Depends(get_current_user)):
    result = await db.quotes.delete_one({"id": quote_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Quote not found")
    return {"message": "Quote deleted", "deleted": 1}


@router.delete("")
async def clear_quotes(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    _: User = Depends(get_current_user),
):
    """
    Bulk-delete quotes.
    - customer_id only → clear all quotes for that client
    - status only      → clear all quotes with that status
    - both             → intersection
    - neither          → clear ALL quotes (use with care)
    """
    query = {}
    if customer_id:
        query["customer_id"] = customer_id
    if status:
        query["status"] = status
    result = await db.quotes.delete_many(query)
    return {"message": f"Deleted {result.deleted_count} quote(s)", "deleted": result.deleted_count}
