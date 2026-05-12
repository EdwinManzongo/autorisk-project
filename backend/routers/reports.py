from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from database import db
from models.user import User
from core.security import get_current_user
import json
from datetime import datetime

router = APIRouter(prefix="/reports", tags=["reports"])

_proj = {"_id": 0}


def _serializable(obj):
    """Recursively make a MongoDB document JSON-safe."""
    if isinstance(obj, dict):
        return {k: _serializable(v) for k, v in obj.items() if k != "_id"}
    if isinstance(obj, list):
        return [_serializable(i) for i in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    try:
        json.dumps(obj)
        return obj
    except (TypeError, ValueError):
        return str(obj)


@router.get("/dashboard")
async def dashboard_stats(_: User = Depends(get_current_user)):
    total_customers  = await db.customers.count_documents({})
    total_quotes     = await db.quotes.count_documents({})
    total_policies   = await db.policies.count_documents({})
    active_policies  = await db.policies.count_documents({"status": "active"})
    pending_quotes   = await db.quotes.count_documents({"status": "pending"})
    accepted_quotes  = await db.quotes.count_documents({"status": "accepted"})

    premium_stats = await db.policies.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {"_id": None,
                    "total_premium": {"$sum": "$annual_premium_usd"},
                    "avg_premium":   {"$avg": "$annual_premium_usd"}}},
    ]).to_list(1)
    total_premium = premium_stats[0]["total_premium"] if premium_stats else 0
    avg_premium   = premium_stats[0]["avg_premium"]   if premium_stats else 0

    risk_dist_raw = await db.quotes.aggregate([
        {"$group": {"_id": "$risk_breakdown.risk_level", "count": {"$sum": 1}}},
    ]).to_list(10)
    risk_distribution = {r["_id"]: r["count"] for r in risk_dist_raw if r["_id"]}

    cov_raw = await db.policies.aggregate([
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$coverage_type", "count": {"$sum": 1}}},
    ]).to_list(10)
    coverage_distribution = {r["_id"]: r["count"] for r in cov_raw if r["_id"]}

    # Recent quotes — use _proj to strip ObjectId, then make fully serializable
    raw_quotes = await db.quotes.find({}, _proj).sort("created_at", -1).to_list(5)
    recent_quotes = []
    for q in raw_quotes:
        safe_q = _serializable(q)
        cust = await db.customers.find_one({"id": q.get("customer_id")}, _proj)
        if cust:
            safe_q["customer_name"] = f"{cust['first_name']} {cust['last_name']}"
        # Keep only lightweight fields for the activity feed
        recent_quotes.append({
            "id":                      safe_q.get("id"),
            "quote_number":            safe_q.get("quote_number"),
            "customer_id":             safe_q.get("customer_id"),
            "customer_name":           safe_q.get("customer_name", ""),
            "status":                  safe_q.get("status"),
            "recommended_premium_usd": safe_q.get("recommended_premium_usd"),
            "ensemble_risk_score":     safe_q.get("ensemble_risk_score"),
            "risk_level":              safe_q.get("risk_breakdown", {}).get("risk_level") if isinstance(safe_q.get("risk_breakdown"), dict) else None,
            "created_at":              safe_q.get("created_at"),
        })

    return {
        "total_customers":          total_customers,
        "total_quotes":             total_quotes,
        "total_policies":           total_policies,
        "active_policies":          active_policies,
        "pending_quotes":           pending_quotes,
        "accepted_quotes":          accepted_quotes,
        "total_annual_premium_usd": round(total_premium, 2),
        "avg_annual_premium_usd":   round(avg_premium, 2),
        "risk_distribution":        risk_distribution,
        "coverage_distribution":    coverage_distribution,
        "recent_quotes":            recent_quotes,
    }


@router.get("/risk-analysis")
async def risk_analysis(_: User = Depends(get_current_user)):
    result = await db.quotes.aggregate([
        {"$group": {
            "_id":               "$risk_breakdown.risk_level",
            "count":             {"$sum": 1},
            "avg_premium":       {"$avg": "$recommended_premium_usd"},
            "avg_risk_score":    {"$avg": "$risk_breakdown.overall_risk_score"},
            "avg_ensemble_score":{"$avg": "$ensemble_risk_score"},
        }},
        {"$sort": {"avg_risk_score": 1}},
    ]).to_list(10)
    for r in result:
        r.pop("_id", None)
        r["avg_premium"]        = round(r.get("avg_premium")        or 0, 2)
        r["avg_risk_score"]     = round(r.get("avg_risk_score")     or 0, 3)
        r["avg_ensemble_score"] = round(r.get("avg_ensemble_score") or 0, 3)
    return result


@router.get("/model-performance")
async def model_performance(_: User = Depends(get_current_user)):
    docs = await db.quotes.find({}, {
        "_id": 0,
        "gb_prediction": 1, "dl_prediction": 1,
        "ensemble_risk_score": 1, "recommended_premium_usd": 1,
        "risk_breakdown.risk_level": 1,
    }).to_list(1000)

    def safe_avg(lst):
        return round(sum(lst) / len(lst), 4) if lst else 0

    gb_preds       = [d["gb_prediction"]       for d in docs if d.get("gb_prediction")       is not None]
    dl_preds       = [d["dl_prediction"]        for d in docs if d.get("dl_prediction")       is not None]
    ensemble_preds = [d["ensemble_risk_score"]  for d in docs if d.get("ensemble_risk_score") is not None]

    return {
        "total_predictions":       len(docs),
        "avg_gb_risk_score":       safe_avg(gb_preds),
        "avg_dl_risk_score":       safe_avg(dl_preds),
        "avg_ensemble_risk_score": safe_avg(ensemble_preds),
        "avg_recommended_premium": round(
            sum(d.get("recommended_premium_usd") or 0 for d in docs) / max(len(docs), 1), 2
        ),
    }
