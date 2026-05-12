import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from seed import seed_database
from routers import auth, users, customers, vehicles, quotes, policies, reports, telematics

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_database()
    yield


app = FastAPI(
    title="AutoRisk Premium Optimizer API",
    description="Hybrid Deep Learning + Gradient Boosting Framework for Dynamic Automobile Insurance Premium Optimization",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = "/api"
for router in [
    auth.router,
    users.router,
    customers.router,
    vehicles.router,
    quotes.router,
    policies.router,
    reports.router,
    telematics.router,
]:
    app.include_router(router, prefix=api_prefix)


if __name__ == "__main__":
    import subprocess
    subprocess.run(["uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8002"])
