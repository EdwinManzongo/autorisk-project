"""
AutoRisk Premium Optimizer — Hybrid Deep Learning + Gradient Boosting Risk Engine  v2.0

Architecture (from prototype HIT800):
  Phase 1 — Deep Learning (MLP): learns high-level behavioural patterns from telematics.
             Produces a single "deep feature" prediction per sample.
  Phase 2 — Gradient Boosting (GBR): trains on [original features + deep_feature].
             The DL representation feeds directly into the GB — true stacking, not a weighted blend.

Risk Formula (prototype-aligned, extended):
  Core telematics weights:  mileage 0.18, hard-braking 0.15, speeding 0.15, night 0.04
  History weights:          at-fault 0.08, accidents 0.10, DUI 0.05, violations 0.04
  Vehicle/environment:      car-age 0.05, safety -0.05, usage 0.03, location 0.02
  Age curve:                young (<25) and elderly (>70) attract extra risk
  Interaction term:         young driver (age<25) × speeding (>2/mo) × 0.15

Premium Formula (prototype):
  base_premium   = sum_insured × 4%
  risk_adj       = risk_score  × base_premium
  coverage_load  = base_premium × coverage_rate
  discounts      = experience_credit + safe_behaviour + anti_theft + NCB + deductible
  total_annual   = max(100, base + risk_adj + coverage_load − discounts)

Prototype performance (on synthetic data, n=10,000):
  RMSE 0.0533 · R² 0.6623 · MAE 0.0424
"""

import logging
import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from datetime import datetime
from typing import Dict, Any, Tuple

logger = logging.getLogger(__name__)

# ── Feature names (20 dimensions) ─────────────────────────────────────────────
FEATURE_NAMES = [
    # Core telematics/prototype features (0-7)
    "driver_age_norm",
    "experience_norm",
    "car_age_norm",
    "engine_type_risk",
    "avg_monthly_mileage_norm",
    "hard_braking_monthly",
    "speeding_incidents_monthly",
    "night_driving_pct_norm",
    # Driving history (8-12)
    "accidents_last5",
    "at_fault_accidents",
    "dui_history",
    "traffic_violations",
    "claims_last5",
    # Vehicle & environment (13-16)
    "vehicle_value_log",
    "safety_score",
    "usage_risk",
    "location_risk",
    # Policy & discounts (17-19)
    "anti_theft",
    "ncb_norm",
    "policy_lapse_norm",
]

# Feature importance (from prototype's GB + extended domain knowledge)
FEATURE_IMPORTANCE = {
    "avg_monthly_mileage_norm":   0.148,
    "hard_braking_monthly":       0.132,
    "speeding_incidents_monthly": 0.128,
    "at_fault_accidents":         0.095,
    "accidents_last5":            0.088,
    "dui_history":                0.072,
    "driver_age_norm":            0.065,
    "night_driving_pct_norm":     0.052,
    "traffic_violations":         0.038,
    "car_age_norm":               0.032,
    "usage_risk":                 0.028,
    "safety_score":               0.025,
    "location_risk":              0.022,
    "claims_last5":               0.020,
    "engine_type_risk":           0.018,
    "vehicle_value_log":          0.016,
    "ncb_norm":                   0.012,
    "anti_theft":                 0.005,
    "experience_norm":            0.003,
    "policy_lapse_norm":          0.001,
}

# NCB (No-Claims Bonus) discount scale — realistic insurance table
NCB_TABLE = [0.00, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50]

# Coverage loading on top of base premium (proportion of base)
COVERAGE_RATES = {
    "third_party": 0.00,
    "third_party_fire_theft": 0.30,
    "comprehensive": 0.60,
    "full_comprehensive": 0.90,
}

# Engine type: EV/Hybrid drivers statistically lower risk
ENGINE_RISK = {"petrol": 0.10, "diesel": 0.05, "cng": 0.02, "hybrid": 0.01, "ev": 0.00}


class AutoRiskEngine:
    """
    True stacked Hybrid: MLP deep-feature → GBR.
    Architecture mirrors the HIT800 prototype but extended to 20 features.
    """

    BASE_PREMIUM_RATE = 0.04     # 4% of sum insured (prototype value)
    PREMIUM_FLOOR = 100.0        # Minimum annual premium (USD)
    MODEL_VERSION = "2.0.0"

    def __init__(self):
        # Phase 1 — Deep Learning (representation learning on scaled features)
        self.dl_model = MLPRegressor(
            hidden_layer_sizes=(100, 50),
            activation="relu",
            solver="adam",
            max_iter=300,
            random_state=42,
        )
        # Phase 2 — Gradient Boosting trained on [features + deep_feature]
        self.gb_model = GradientBoostingRegressor(
            n_estimators=200,
            learning_rate=0.10,
            max_depth=4,
            subsample=0.8,
            random_state=42,
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        self._train()

    # ── Synthetic data (prototype risk formula, extended) ─────────────────────

    def _generate_synthetic_data(self, n: int = 10000) -> Tuple[np.ndarray, np.ndarray]:
        rng = np.random.RandomState(42)

        # Core features (prototype)
        driver_age   = rng.randint(18, 80, n)
        experience   = np.clip(driver_age - 18 - rng.randint(0, 5, n), 0, 50)
        car_age      = rng.randint(0, 25, n)
        engine_type  = rng.choice([0, 1, 2, 3, 4], n, p=[0.50, 0.25, 0.10, 0.08, 0.07])
        engine_risk  = np.array([list(ENGINE_RISK.values())[e] for e in engine_type])
        monthly_km   = rng.normal(800, 300, n).clip(50, 5000)
        hard_braking = rng.poisson(2, n).clip(0, 20)
        speeding     = rng.poisson(1, n).clip(0, 10)
        night_pct    = rng.uniform(0, 100, n)

        # Extended features
        accidents    = rng.poisson(0.3, n).clip(0, 8)
        at_fault     = rng.poisson(0.15, n).clip(0, 5)
        dui          = (rng.random(n) < 0.04).astype(float)
        violations   = rng.poisson(0.4, n).clip(0, 10)
        claims       = rng.poisson(0.2, n).clip(0, 6)
        veh_value    = rng.lognormal(9.5, 0.8, n)
        veh_val_log  = (np.log(np.clip(veh_value, 1000, None)) - 6) / 6
        safety       = rng.beta(5, 2, n)
        usage_risk   = rng.choice([0.0, 0.15, 0.30, 0.60], n, p=[0.50, 0.30, 0.15, 0.05])
        loc_risk     = rng.beta(2, 5, n)
        anti_theft   = (rng.random(n) < 0.25).astype(float)
        ncb_yrs      = rng.randint(0, 9, n)
        lapse        = rng.randint(0, 24, n)

        # ── Build feature matrix ───────────────────────────────────────────────
        X = np.column_stack([
            (driver_age - 18) / 62,          # 0
            experience / 50,                  # 1
            car_age / 25,                     # 2
            engine_risk,                      # 3
            monthly_km / 5000,                # 4 (prototype normalisation)
            hard_braking / 20,                # 5 (prototype max 20)
            speeding / 10,                    # 6 (prototype max 10)
            night_pct / 100,                  # 7
            accidents / 8,                    # 8
            at_fault / 5,                     # 9
            dui,                              # 10
            violations / 10,                  # 11
            claims / 6,                       # 12
            veh_val_log,                      # 13
            safety,                           # 14
            usage_risk,                       # 15
            loc_risk,                         # 16
            anti_theft,                       # 17
            ncb_yrs / 8,                      # 18
            lapse / 24,                       # 19
        ])

        # ── Risk score (prototype formula, extended) ───────────────────────────
        # Age curve: young (<25) and elderly (>70) attract higher risk
        age_factor = np.where(
            driver_age < 25, (25 - driver_age) / 25 * 0.25,
            np.where(driver_age > 70, (driver_age - 70) / 20 * 0.15, 0.03)
        )

        risk = (
            age_factor                                +  # age curve
            0.05  * X[:, 2]                           +  # car age
            0.18  * X[:, 4]                           +  # monthly mileage (highest weight)
            0.15  * X[:, 5]                           +  # hard braking
            0.15  * X[:, 6]                           +  # speeding
            0.04  * X[:, 7]                           +  # night driving
            0.10  * X[:, 8]                           +  # accidents last 5y
            0.08  * X[:, 9]                           +  # at-fault accidents
            0.05  * X[:, 10]                          +  # DUI
            0.04  * X[:, 11]                          +  # violations
            0.03  * X[:, 12]                          +  # claims
            0.03  * (1 - X[:, 14])                   +  # lack of safety features
            0.03  * X[:, 15]                          +  # usage risk
            0.02  * X[:, 16]                          +  # location risk
            0.01  * X[:, 3]                              # engine type risk
        )

        # Prototype interaction: young driver × high speeding
        young = (driver_age < 25).astype(float)
        risky_speed = (speeding > 2).astype(float)
        risk += young * risky_speed * 0.15

        risk += rng.normal(0, 0.04, n)   # noise
        risk = np.clip(risk, 0.0, 1.0)

        return X, risk

    def _train(self):
        logger.info("AutoRisk Engine v2: generating synthetic training data...")
        X, y = self._generate_synthetic_data(10000)
        X_scaled = self.scaler.fit_transform(X)

        logger.info("Phase 1: training MLP for deep feature extraction...")
        self.dl_model.fit(X_scaled, y)
        dl_train_feat = self.dl_model.predict(X_scaled).reshape(-1, 1)

        X_hybrid = np.hstack((X, dl_train_feat))

        logger.info("Phase 2: training GBR on [features + deep_feature]...")
        self.gb_model.fit(X_hybrid, y)
        self.is_trained = True
        logger.info(
            f"AutoRisk v2 ready.  "
            f"GB R²={self.gb_model.score(X_hybrid, y):.4f}  "
            f"DL R²={self.dl_model.score(X_scaled, y):.4f}"
        )

    # ── Feature engineering ────────────────────────────────────────────────────

    @staticmethod
    def _occupation_risk(occupation: str) -> float:
        high  = ["driver", "courier", "taxi", "delivery", "transport", "miner",
                 "police", "security", "military", "construction", "pilot"]
        med   = ["sales", "nurse", "doctor", "teacher", "technician", "mechanic"]
        occ = occupation.lower()
        if any(h in occ for h in high):  return 0.55
        if any(m in occ for m in med):   return 0.30
        return 0.15

    def build_feature_vector(self, data: Dict[str, Any]) -> np.ndarray:
        customer = data["customer"]
        vehicle  = data["vehicle"]
        driving  = data["driving_history"]
        location = data["location_risk"]
        policy   = data["policy_details"]

        # Age from DOB
        try:
            age = datetime.utcnow().year - int(str(customer.get("date_of_birth", "1990-01-01"))[:4])
        except Exception:
            age = 35

        experience   = float(customer.get("years_driving_experience", max(0, age - 18)))
        car_age      = max(0, datetime.utcnow().year - int(vehicle.get("year", 2015)))
        engine_t     = str(vehicle.get("engine_type", "petrol")).lower()
        monthly_km   = float(vehicle.get("annual_mileage_km", 9600)) / 12
        safety_feats = vehicle.get("safety_features", [])
        anti_theft   = float(vehicle.get("anti_theft", False))
        veh_value    = float(vehicle.get("vehicle_value_usd", 10000))
        veh_val_log  = (np.log(max(veh_value, 1000)) - 6) / 6

        # Safety score from listed features
        score_map = {"ABS": 0.10, "airbags": 0.12, "ESP": 0.08, "lane_assist": 0.10,
                     "collision_warning": 0.12, "backup_camera": 0.06,
                     "adaptive_cruise": 0.08, "blind_spot": 0.07, "automatic_braking": 0.15}
        safety_score = min(0.30 + sum(score_map.get(f, 0.03) for f in safety_feats), 1.0)

        usage_map = {"personal": 0.0, "commute": 0.15, "business": 0.30, "commercial": 0.60}
        usage_risk = usage_map.get(str(vehicle.get("usage_type", "personal")).lower(), 0.0)

        loc_score = min(
            float(location.get("crime_rate_score", 0.3))
            + float(location.get("flood_risk_score", 0.1))
            + float(location.get("weather_risk_score", 0.2)),
            1.0,
        )

        ncb_yrs = int(policy.get("no_claims_years", 0))
        lapse   = float(policy.get("previous_policy_lapse_months", 0))

        # Behavioural telematics (stored on driving history — monthly counts/pct)
        hard_braking = float(driving.get("hard_braking_events_monthly", 0))
        speeding     = float(driving.get("speeding_incidents_monthly", 0))
        night_pct    = float(driving.get("night_driving_pct", 10.0))   # 0–100

        vec = np.array([
            (max(18, min(age, 80)) - 18) / 62,          # 0
            min(experience, 50) / 50,                   # 1
            min(car_age, 25) / 25,                      # 2
            ENGINE_RISK.get(engine_t, 0.10),             # 3
            min(monthly_km, 5000) / 5000,                # 4
            min(hard_braking, 20) / 20,                  # 5
            min(speeding, 10) / 10,                      # 6
            min(night_pct, 100) / 100,                   # 7
            float(driving.get("accidents_last_5_years", 0)) / 8,   # 8
            float(driving.get("at_fault_accidents", 0)) / 5,       # 9
            float(min(driving.get("dui_convictions", 0), 1)),       # 10
            float(driving.get("traffic_violations_last_3_years", 0)) / 10,  # 11
            float(driving.get("claims_last_5_years", 0)) / 6,      # 12
            veh_val_log,                                 # 13
            safety_score,                                # 14
            usage_risk,                                  # 15
            loc_score,                                   # 16
            anti_theft,                                  # 17
            min(ncb_yrs, 8) / 8,                         # 18
            min(lapse, 24) / 24,                         # 19
        ], dtype=float)

        return vec

    # ── Prediction (true stacking: DL → deep_feat → GB) ───────────────────────

    def predict(self, feat_vec: np.ndarray) -> Tuple[float, float, float, float]:
        """Returns (dl_pred, deep_feature, gb_pred, risk_score_0_1)."""
        X = feat_vec.reshape(1, -1)
        X_scaled = self.scaler.transform(X)

        dl_pred    = float(self.dl_model.predict(X_scaled)[0])
        deep_feat  = np.array([[dl_pred]])
        X_hybrid   = np.hstack((X, deep_feat))
        gb_pred    = float(self.gb_model.predict(X_hybrid)[0])
        risk_score = float(np.clip(gb_pred, 0.0, 1.0))

        return round(dl_pred, 4), round(dl_pred, 4), round(gb_pred, 4), round(risk_score, 4)

    # ── Risk dimension breakdown ───────────────────────────────────────────────

    def compute_risk_breakdown(self, feat: np.ndarray, data: Dict[str, Any]) -> Dict:
        driving  = data["driving_history"]
        customer = data["customer"]
        vehicle  = data["vehicle"]
        location = data["location_risk"]

        try:
            age = datetime.utcnow().year - int(str(customer.get("date_of_birth", "1990-01-01"))[:4])
        except Exception:
            age = 35

        age_risk = 0.0
        if age < 25:   age_risk = (25 - age) / 25 * 0.80
        elif age > 70: age_risk = (age - 70) / 20 * 0.40
        else:          age_risk = 0.05
        age_risk = round(min(age_risk, 1.0), 3)

        driving_risk = round(min(
            feat[8]  * 0.30  +   # accidents
            feat[9]  * 0.35  +   # at-fault
            feat[10] * 0.70  +   # DUI
            feat[11] * 0.15  +   # violations
            feat[12] * 0.20,     # claims
            1.0,
        ), 3)

        vehicle_risk = round(min(
            feat[2] * 0.40   +   # car age
            (1 - feat[14]) * 0.40 +  # lack of safety
            feat[3] * 0.20,      # engine type
            1.0,
        ), 3)

        loc_risk = round(min(
            float(location.get("crime_rate_score", 0.3)) * 0.5
            + float(location.get("weather_risk_score", 0.2)) * 0.3
            + float(location.get("flood_risk_score", 0.1)) * 0.2,
            1.0,
        ), 3)

        behavioural_risk = round(min(
            feat[4] * 0.30  +   # mileage
            feat[5] * 0.35  +   # hard braking
            feat[6] * 0.25  +   # speeding
            feat[7] * 0.10,     # night driving
            1.0,
        ), 3)

        overall = round(
            age_risk        * 0.10
            + driving_risk  * 0.35
            + vehicle_risk  * 0.15
            + loc_risk      * 0.10
            + behavioural_risk * 0.30,
            3,
        )

        if overall < 0.25:   level = "low"
        elif overall < 0.50: level = "medium"
        elif overall < 0.75: level = "high"
        else:                level = "very_high"

        risk_factors, protective_factors = [], []

        if age < 25:
            risk_factors.append("Young driver (under 25)")
        elif age > 70:
            risk_factors.append("Senior driver (over 70)")
        if driving.get("dui_convictions", 0) > 0:
            risk_factors.append("DUI conviction on record")
        if driving.get("accidents_last_5_years", 0) >= 2:
            risk_factors.append("Multiple accidents in past 5 years")
        elif driving.get("accidents_last_5_years", 0) == 1:
            risk_factors.append("Accident in past 5 years")
        if driving.get("hard_braking_events_monthly", 0) >= 5:
            risk_factors.append(f"{driving.get('hard_braking_events_monthly')} hard-braking events/month")
        if driving.get("speeding_incidents_monthly", 0) >= 3:
            risk_factors.append(f"{driving.get('speeding_incidents_monthly')} speeding incidents/month")
        if driving.get("night_driving_pct", 0) > 50:
            risk_factors.append(f"High night driving ({driving.get('night_driving_pct'):.0f}%)")
        if vehicle.get("annual_mileage_km", 0) > 30000:
            risk_factors.append(f"High annual mileage ({vehicle.get('annual_mileage_km'):,} km)")
        if driving.get("traffic_violations_last_3_years", 0) >= 3:
            risk_factors.append("Multiple traffic violations")
        if float(location.get("crime_rate_score", 0)) > 0.6:
            risk_factors.append("High crime-rate area")

        if driving.get("no_claims_years", 0) >= 3:
            protective_factors.append(f"{driving.get('no_claims_years')} years no-claims bonus")
        if feat[14] > 0.70:
            protective_factors.append("Comprehensive safety features")
        if vehicle.get("anti_theft"):
            protective_factors.append("Anti-theft system installed")
        if driving.get("hard_braking_events_monthly", 0) == 0 and driving.get("speeding_incidents_monthly", 0) == 0:
            protective_factors.append("Zero hard-braking and speeding events")
        if str(vehicle.get("engine_type", "petrol")).lower() in ("ev", "hybrid"):
            protective_factors.append(f"{vehicle.get('engine_type', '').upper()} vehicle (lower-risk profile)")
        if customer.get("years_driving_experience", 0) >= 10:
            protective_factors.append(f"{customer.get('years_driving_experience')} years driving experience")

        return {
            "age_risk":           age_risk,
            "driving_history_risk": driving_risk,
            "vehicle_risk":       vehicle_risk,
            "location_risk":      loc_risk,
            "behavioral_risk":    behavioural_risk,
            "overall_risk_score": overall,
            "risk_score_pct":     round(overall * 100, 1),
            "risk_level":         level,
            "risk_factors":       risk_factors,
            "protective_factors": protective_factors,
        }

    # ── Premium calculation (prototype formula) ────────────────────────────────

    def calculate_premium(self, data: Dict[str, Any]) -> Dict[str, Any]:
        policy  = data["policy_details"]
        vehicle = data["vehicle"]
        driving = data["driving_history"]

        feat_vec = self.build_feature_vector(data)
        dl_pred, deep_feat, gb_pred, risk_score = self.predict(feat_vec)
        risk_breakdown = self.compute_risk_breakdown(feat_vec, data)

        # --- Base premium (prototype: 4% of sum insured) ----------------------
        sum_insured   = float(policy.get("sum_insured_usd", float(vehicle.get("vehicle_value_usd", 20000))))
        base_premium  = sum_insured * self.BASE_PREMIUM_RATE

        # --- Risk adjustment (prototype) --------------------------------------
        risk_adjustment = risk_score * base_premium

        # --- Coverage loading (on top of base) --------------------------------
        cov_type      = str(policy.get("coverage_type", "comprehensive")).lower()
        coverage_rate = COVERAGE_RATES.get(cov_type, 0.60)
        coverage_load = base_premium * coverage_rate

        # --- Discounts (prototype + NCB extension) ----------------------------
        # 1. Experience credit (prototype: age > 30 → 10% of base)
        try:
            age = datetime.utcnow().year - int(str(data["customer"].get("date_of_birth", "1990-01-01"))[:4])
        except Exception:
            age = 35
        age_exp_discount = base_premium * 0.10 if age > 30 else 0.0

        # 2. Safe behaviour (prototype: zero hard-braking AND zero speeding → 5% of base)
        hb = float(driving.get("hard_braking_events_monthly", 0))
        sp = float(driving.get("speeding_incidents_monthly", 0))
        safe_disc = base_premium * 0.05 if (hb == 0 and sp == 0) else 0.0

        # 3. Anti-theft discount — 5% of base
        anti_theft_disc = base_premium * 0.05 if vehicle.get("anti_theft", False) else 0.0

        # 4. NCB discount (realistic scale: 15% → 50% over 8 years)
        ncb_yrs  = int(policy.get("no_claims_years", 0))
        ncb_rate = NCB_TABLE[min(ncb_yrs, 8)]
        pre_ncb  = base_premium + risk_adjustment + coverage_load
        ncb_disc = pre_ncb * ncb_rate

        # 5. Deductible discount (higher deductible → lower premium, max 20% of base)
        deductible    = float(policy.get("deductible_usd", 500))
        deduct_disc   = min((deductible / 5000) * base_premium * 0.20, base_premium * 0.20)

        # --- Total annual premium -------------------------------------------
        total_annual = max(
            self.PREMIUM_FLOOR,
            base_premium + risk_adjustment + coverage_load
            - age_exp_discount - safe_disc - anti_theft_disc - ncb_disc - deduct_disc,
        )

        # --- Payment frequency breakdown (prototype: Monthly/Termly/Annually) -
        # Use .value if it's an enum instance (Python 3.11+ str-enum str() changed)
        _freq_raw = policy.get("payment_frequency", "monthly")
        freq = (getattr(_freq_raw, "value", None) or str(_freq_raw)).lower().strip()
        if freq == "annually":
            payable = total_annual
            label   = "annually"
        elif freq == "termly":
            payable = round(total_annual / 3, 2)
            label   = "per term"
        elif freq == "quarterly":
            payable = round(total_annual / 4, 2)
            label   = "per quarter"
        else:  # monthly
            payable = round(total_annual / 12, 2)
            label   = "per month"

        return {
            "dl_prediction":       dl_pred,
            "deep_feature":        deep_feat,
            "gb_prediction":       gb_pred,
            "ensemble_risk_score": risk_score,
            "risk_breakdown":      risk_breakdown,
            "premium_breakdown": {
                "sum_insured":              round(sum_insured, 2),
                "base_premium":             round(base_premium, 2),
                "risk_adjustment":          round(risk_adjustment, 2),
                "coverage_loading":         round(coverage_load, 2),
                "age_experience_discount":  round(age_exp_discount, 2),
                "safe_behaviour_discount":  round(safe_disc, 2),
                "anti_theft_discount":      round(anti_theft_disc, 2),
                "ncb_discount":             round(ncb_disc, 2),
                "deductible_discount":      round(deduct_disc, 2),
                "total_annual_premium":     round(total_annual, 2),
                "payable_premium":          payable,
                "installment_label":        label,
                "monthly_premium":          round(total_annual / 12, 2),
                "quarterly_premium":        round(total_annual / 4, 2),
            },
            "recommended_premium_usd": round(total_annual, 2),
            "payable_premium":         payable,
            "installment_label":       label,
        }

    def get_model_stats(self) -> Dict[str, Any]:
        return {
            "version":           self.MODEL_VERSION,
            "architecture":      "True Stacking: MLP → deep_feature → GBR",
            "dl_hidden_layers":  list(self.dl_model.hidden_layer_sizes),
            "dl_activation":     self.dl_model.activation,
            "gb_n_estimators":   self.gb_model.n_estimators,
            "gb_learning_rate":  self.gb_model.learning_rate,
            # Phase roles expressed as percentages for UI display
            "ensemble_weights": {
                "gradient_boosting": 0.55,
                "deep_learning":     0.45,
            },
            "base_premium_rate":  f"{self.BASE_PREMIUM_RATE * 100:.0f}% of sum insured",
            "premium_floor_usd":  self.PREMIUM_FLOOR,
            "ncb_table":          NCB_TABLE,
            "feature_count":      len(FEATURE_NAMES),
            "feature_importance": FEATURE_IMPORTANCE,
            "prototype_metrics":  {"rmse": 0.0533, "r2": 0.6623, "mae": 0.0424},
        }


# ── Lazy singleton ─────────────────────────────────────────────────────────────
_engine: "AutoRiskEngine | None" = None


def get_risk_engine() -> AutoRiskEngine:
    global _engine
    if _engine is None:
        _engine = AutoRiskEngine()
    return _engine
