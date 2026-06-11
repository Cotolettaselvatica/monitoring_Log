from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import load_settings
from app.db import close_pool, init_pool, get_cursor
from app.routers import charts, dashboard, logs, machines, metrics, vettasoft_proxy


logger = logging.getLogger(__name__)


def _apply_schema() -> None:
    schema_path = Path(__file__).resolve().parents[1] / "sql" / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    try:
        with get_cursor() as cur:
            cur.execute(sql)
    except Exception:
        logger.exception(
            "Impossibile applicare schema dashboard automaticamente; "
            "eseguire sql/setup-dashboard.sh come utente con permessi DDL"
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    init_pool(settings)
    _apply_schema()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    yield
    close_pool()


def create_app() -> FastAPI:
    settings = load_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    app = FastAPI(
        title="Cruscotto CATIS API",
        description="Backend per il dashboard produzione (PostgreSQL conteggi_pezzi)",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(machines.router)
    app.include_router(logs.router)
    app.include_router(charts.router)
    app.include_router(metrics.router)
    app.include_router(dashboard.router)
    app.include_router(vettasoft_proxy.router)
    app.mount("/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
