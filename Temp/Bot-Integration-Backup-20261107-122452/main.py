import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.market import router as market_router
from backend.app.api.dreamdex import router as dreamdex_router
from backend.app.api.trading import router as trading_router


app = FastAPI(
    title="PerpPilot AI",
    description="Market data and analytics API for PerpPilot AI (dreamDEX perps on Somnia)",
    version="1.0.0",
)

frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)

allowed_origins = [
    origin.strip()
    for origin in frontend_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(market_router)
app.include_router(dreamdex_router)
app.include_router(trading_router)


@app.get("/")
def root():
    return {
        "message": "PerpPilot AI is running",
        "status": "online",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AegisTrade AI",
    }

