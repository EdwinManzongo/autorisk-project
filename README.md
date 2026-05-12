# AutoRisk Premium Optimizer

**Hybrid Deep Learning + Gradient Boosting Framework for Dynamic Automobile Insurance Premium Optimization**

AutoRisk is a full-stack insurance underwriting platform that combines a stacked Deep Learning / Gradient Boosting AI engine with a modern React dashboard. Insurance companies enter customer, vehicle, driving-history, and telematics data; the system produces a dynamically priced premium recommendation, a risk breakdown across five dimensions, and a full audit trail of quotes and policies.

---

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [AI Model](#ai-model)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Getting Started](#getting-started)
7. [Default Credentials](#default-credentials)
8. [API Reference](#api-reference)
9. [Premium Calculation Formula](#premium-calculation-formula)
10. [Risk Factor Categories](#risk-factor-categories)
11. [Telematics Upload](#telematics-upload)

---

## Features

| Module | Capabilities |
|---|---|
| **Premium Calculator** | 4-step guided wizard; AI-powered risk scoring; payment frequency breakdown (monthly / termly / quarterly / annually) |
| **Telematics** | Excel template download; bulk upload with vehicle auto-matching; visual metric cards (mileage, hard braking, speeding, night driving) with colour-coded risk bands |
| **Quote Management** | View, accept, reject, update (recalculate in-place), delete, and bulk-clear quotes; duplicate-client warning |
| **Policy Management** | Create from accepted quote; renew with revised premium; cancel; duplicate-active-policy guard; click-through detail dialog |
| **Customer Management** | CRUD with search; minimal required fields (first name, last name, DOB) |
| **Vehicle Management** | Engine type (Petrol / Diesel / EV / Hybrid / CNG), safety features, anti-theft flag |
| **Reports & Analytics** | Risk-level distribution, premium-by-risk bar charts, coverage-mix pie charts |
| **AI Model Insights** | Feature importance chart (top 15), architecture display, ensemble weight breakdown |
| **User Management** | Admin / Underwriter / Agent roles; JWT authentication |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│   (port 3000)  shadcn/ui · Tailwind · Recharts       │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / JSON (Axios)
┌────────────────────▼────────────────────────────────┐
│                FastAPI Backend                       │
│   (port 8002)  Pydantic v2 · JWT · CORS             │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │          AutoRisk ML Engine  v2.0            │  │
│   │                                              │  │
│   │   Phase 1: MLP (100 → 50)                   │  │
│   │      ↓  produces deep_feature               │  │
│   │   Phase 2: GBR trained on                   │  │
│   │            [20 features + deep_feature]      │  │
│   └──────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │ Motor (async)
┌────────────────────▼────────────────────────────────┐
│              MongoDB  (port 27017)                   │
│   Collections: users · customers · vehicles          │
│                quotes · policies · telematics        │
└─────────────────────────────────────────────────────┘
```

---

## AI Model

### Architecture — True Stacking (v2.0.0)

The hybrid engine uses a **two-phase stacked approach** (not a weighted blend):

| Phase | Component | Details |
|---|---|---|
| 1 | **Deep Learning** — `MLPRegressor` | Hidden layers: 100 → 50; Activation: ReLU; Solver: Adam |
| 2 | **Gradient Boosting** — `GradientBoostingRegressor` | 200 estimators; learning rate 0.10; max depth 4 |

**How it works:**
1. The MLP learns high-level behavioural patterns from the 20-dimensional feature vector and outputs a single `deep_feature` value.
2. The GBR trains on `[original 20 features + deep_feature]` for precise risk scoring.
3. The GBR's output is the final **Risk Score (0–1)**.

### Training Data

10,000 synthetic samples generated with actuarially-realistic correlations:
- Young drivers (< 25) and DUI history attract the highest risk weights
- Mileage, hard braking, and speeding are the three most predictive features
- Interaction term: `young_driver × high_speeding → +0.15 risk`

### Model Performance (synthetic benchmark)

| Metric | Value |
|---|---|
| RMSE | 0.0533 |
| R² | 0.6623 |
| MAE | 0.0424 |

### Top Feature Importances

| Rank | Feature | Importance |
|---|---|---|
| 1 | Avg. Monthly Mileage | 14.8% |
| 2 | Hard Braking Events | 13.2% |
| 3 | Speeding Incidents | 12.8% |
| 4 | At-fault Accidents | 9.5% |
| 5 | Accidents (last 5 yrs) | 8.8% |
| 6 | DUI History | 7.2% |
| 7 | Driver Age | 6.5% |

---

## Tech Stack

### Backend

| Package | Version | Purpose |
|---|---|---|
| FastAPI | 0.110.1 | REST API framework |
| Pydantic | 2.12.4 | Data validation & serialisation |
| Motor | 3.3.1 | Async MongoDB driver |
| scikit-learn | 1.4.2 | MLPRegressor + GradientBoostingRegressor |
| NumPy | 1.26.4 | Numerical computing |
| Pandas | 2.2.2 | Data manipulation |
| openpyxl | 3.1.2 | Excel template generation & upload parsing |
| PyJWT | 2.10.1 | JWT authentication |
| bcrypt | 3.2.2 | Password hashing |
| uvicorn | 0.25.0 | ASGI server |

### Frontend

| Package | Version | Purpose |
|---|---|---|
| React | 19.0.0 | UI framework |
| React Router | 7.5.1 | Client-side routing |
| Axios | 1.8.4 | HTTP client |
| shadcn/ui + Radix UI | — | Component library |
| Tailwind CSS | 3.4.17 | Utility-first styling |
| Recharts | 2.12.7 | Charts (bar, pie) |
| Sonner | 2.0.3 | Toast notifications |
| Lucide React | 0.507.0 | Icons |
| CRACO | 7.1.0 | CRA config override |

---

## Project Structure

```
autorisk/
├── setup.sh                        # One-command dev startup
├── backend/
│   ├── main.py                     # FastAPI app, CORS, router registration
│   ├── config.py                   # Environment config (.env loader)
│   ├── database.py                 # Motor async MongoDB client
│   ├── seed.py                     # Default user seeding on startup
│   ├── requirements.txt
│   ├── ml/
│   │   └── risk_engine.py          # Hybrid DL+GB engine (lazy-loaded singleton)
│   ├── models/
│   │   ├── customer.py
│   │   ├── vehicle.py
│   │   ├── quote.py                # DrivingHistory, PolicyDetails, RiskBreakdown, PremiumBreakdown
│   │   ├── policy.py               # Policy, PolicyCreate, PolicyRenew
│   │   ├── telematics.py
│   │   ├── user.py
│   │   └── enums.py                # Gender, CoverageType, EngineType, PaymentFrequency, …
│   └── routers/
│       ├── auth.py
│       ├── customers.py
│       ├── vehicles.py
│       ├── quotes.py               # calculate, recalculate, delete, bulk-clear
│       ├── policies.py             # create, renew, check-active
│       ├── telematics.py           # template download, Excel upload, CRUD
│       ├── reports.py              # dashboard stats, risk-analysis, model-performance
│       └── users.py
└── frontend/
    ├── public/index.html
    └── src/
        ├── App.js
        ├── lib/utils.js            # cn(), parseApiError()
        ├── pages/
        │   ├── LoginPage.js
        │   └── Dashboard.js        # Tab-based shell
        └── components/admin/
            ├── Overview.js
            ├── PremiumCalculator.js
            ├── QuoteHistory.js
            ├── PolicyManagement.js
            ├── CustomerManagement.js
            ├── VehicleManagement.js
            ├── TelematicsManagement.js
            ├── Reports.js
            ├── ModelInsights.js
            └── UsersManagement.js
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| Yarn | 1.22+ |
| MongoDB | 6.0+ (running on `localhost:27017`) |

### Quick Start

```bash
# Clone / navigate to project root
cd autorisk

# Make setup script executable (if not already)
chmod +x setup.sh

# Start both backend and frontend
./setup.sh
```

The script will:
1. Create a Python virtual environment (`backend/venv`)
2. Install all Python dependencies
3. Install Node.js dependencies (`yarn install`)
4. Start the backend on **http://localhost:8002** (uvicorn, with `--reload`)
5. Start the frontend on **http://localhost:3000**

Press `Ctrl+C` to stop both servers.

### Manual Setup

```bash
# ── Backend ──────────────────────────────────────────
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start backend
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8002

# ── Frontend (separate terminal) ─────────────────────
cd frontend
yarn install
yarn start
```

### Environment Variables

**`backend/.env`**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=autorisk
SECRET_KEY=your-secret-key-here
```

**`frontend/.env`**
```env
REACT_APP_BACKEND_URL=http://localhost:8002
```

---

## Default Credentials

Seeded automatically on first backend startup:

| Email | Password | Role |
|---|---|---|
| `admin@autorisk.com` | `admin123` | Admin |
| `underwriter@autorisk.com` | `pass123` | Underwriter |
| `agent@autorisk.com` | `pass123` | Agent |

> Change these before any production deployment.

---

## API Reference

Interactive Swagger docs: **http://localhost:8002/docs**

### Authentication

```
POST /api/auth/login
Body: { "email": "...", "password": "..." }
Returns: { "access_token": "...", "user": {...} }
```

All other endpoints require `Authorization: Bearer <token>`.

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/quotes/calculate` | Calculate premium (runs AI engine) |
| `PUT` | `/api/quotes/{id}/recalculate` | Update quote in place, re-run engine |
| `DELETE` | `/api/quotes/{id}` | Delete single quote |
| `DELETE` | `/api/quotes?status=X&customer_id=Y` | Bulk delete quotes |
| `POST` | `/api/policies/{id}/renew` | Renew a policy |
| `GET` | `/api/policies/check-active?customer_id=X&vehicle_id=Y` | Check for existing active policy |
| `GET` | `/api/telematics/template` | Download Excel upload template |
| `POST` | `/api/telematics/upload` | Upload telematics Excel file |
| `GET` | `/api/telematics/vehicle/{id}/latest` | Latest telematics for a vehicle |
| `GET` | `/api/reports/dashboard` | Aggregated dashboard stats |
| `GET` | `/api/quotes/model/stats` | AI model metadata & feature importances |

---

## Premium Calculation Formula

```
sum_insured      = policy sum insured (USD)
base_premium     = sum_insured × 4%

risk_adjustment  = risk_score × base_premium          (risk_score: 0–1 from AI engine)
coverage_loading = base_premium × coverage_rate        (0% TPO → 90% Full Comprehensive)

discounts:
  experience_credit  = base × 10%   if driver age > 30
  safe_behaviour     = base ×  5%   if hard_braking = 0 AND speeding = 0 (monthly)
  anti_theft         = base ×  5%   if anti-theft system fitted
  ncb_discount       = pre-discount total × ncb_rate  (15% yr1 → 50% yr8+)
  deductible_discount= base × 20% × (deductible / $5,000)

total_annual = max($100,
    base + risk_adjustment + coverage_loading
    − experience_credit − safe_behaviour − anti_theft − ncb − deductible_discount
)

payable:
  monthly   = total_annual / 12
  termly    = total_annual / 3
  quarterly = total_annual / 4
  annually  = total_annual
```

**NCB Scale**

| Years | Discount |
|---|---|
| 1 | 15% |
| 2 | 20% |
| 3 | 25% |
| 4 | 30% |
| 5 | 35% |
| 6 | 40% |
| 7 | 45% |
| 8+ | 50% |

---

## Risk Factor Categories

The AI engine uses a **20-dimensional feature vector** across six categories:

| Category | Features |
|---|---|
| **Demographics** | Driver age (age curve: < 25 and > 70 attract higher risk), gender, marital status |
| **Driving History** | Accidents (5 yr), at-fault accidents, traffic violations (3 yr), DUI convictions, claims (5 yr) |
| **Vehicle** | Car age, vehicle value, engine type (EV/Hybrid = lower risk), safety features score |
| **Usage & Mileage** | Monthly mileage, usage type (Personal → Commercial) |
| **Policy** | Coverage type, deductible, NCB years, previous policy lapse |
| **Behavioural / Telematics** | Monthly hard-braking events, monthly speeding incidents, night-driving %, location risk |

### Risk Score → Risk Level

| Score | Level |
|---|---|
| 0.00 – 0.24 | Low |
| 0.25 – 0.49 | Medium |
| 0.50 – 0.74 | High |
| 0.75 – 1.00 | Very High |

---

## Telematics Upload

The system supports batch telematics data entry via Excel.

### Workflow

1. Go to **Telematics** tab → click **Download Template**
2. Fill in one row per vehicle per month (delete the sample row)
3. Enter the exact vehicle **Registration Number** as it appears in the system
4. Click **Upload Excel** — records are saved and linked to vehicles automatically
5. In the **Premium Calculator**, click **Auto-load** to populate the telematics panel from the latest uploaded record for the selected vehicle

### Template Columns

| Column | Required | Range |
|---|---|---|
| `Vehicle_Registration` | Yes | Must match system |
| `Customer_Name` | No | Reference only |
| `Period_Month` | Yes | `YYYY-MM` |
| `Avg_Monthly_Mileage_km` | Yes | 50 – 5,000 |
| `Hard_Braking_Events` | Yes | 0 – 20 |
| `Speeding_Incidents` | Yes | 0 – 10 |
| `Night_Driving_Pct` | Yes | 0 – 100 |
| `Notes` | No | Free text |

---

## Roles & Permissions

| Feature | Agent | Underwriter | Admin |
|---|---|---|---|
| Calculate quotes | ✓ | ✓ | ✓ |
| Accept / reject quotes | ✓ | ✓ | ✓ |
| Create / renew policies | ✓ | ✓ | ✓ |
| Upload telematics | ✓ | ✓ | ✓ |
| View AI model insights | — | — | ✓ |
| Manage users | — | — | ✓ |

---

## License

Internal use — Xarani Systems.
