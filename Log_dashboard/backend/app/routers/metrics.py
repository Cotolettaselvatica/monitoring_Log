from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas import FleetMetrics, MachineMetrics
from app.services import analytics

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/fleet", response_model=FleetMetrics)
def fleet_metrics(periodDays: int = 7) -> FleetMetrics:
    return analytics.fleet_metrics(periodDays)


@router.get("/machines/{machine_id}", response_model=MachineMetrics)
def machine_metrics(machine_id: str, periodDays: int = 7) -> MachineMetrics:
    metrics = analytics.machine_metrics(machine_id, periodDays)
    if not metrics:
        raise HTTPException(status_code=404, detail="Macchinario non trovato")
    return metrics
