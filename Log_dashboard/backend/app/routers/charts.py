from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas import ChartSeriesPoint
from app.services import analytics
from app.services import machines as machine_service

router = APIRouter(tags=["charts"])


def _chart(period: str, machine_id: str | None = None) -> list[ChartSeriesPoint]:
    if machine_id and not machine_service.get_machine(machine_id):
        raise HTTPException(status_code=404, detail="Macchinario non trovato")
    return analytics.chart_series(period, machine_id)


@router.get("/charts/events/hourly", response_model=list[ChartSeriesPoint])
def chart_hourly() -> list[ChartSeriesPoint]:
    return _chart("hourly")


@router.get("/charts/events/daily", response_model=list[ChartSeriesPoint])
def chart_daily() -> list[ChartSeriesPoint]:
    return _chart("daily")


@router.get("/charts/events/weekly", response_model=list[ChartSeriesPoint])
def chart_weekly() -> list[ChartSeriesPoint]:
    return _chart("weekly")


@router.get("/charts/events/monthly", response_model=list[ChartSeriesPoint])
def chart_monthly() -> list[ChartSeriesPoint]:
    return _chart("monthly")


@router.get("/charts/events/yearly", response_model=list[ChartSeriesPoint])
def chart_yearly() -> list[ChartSeriesPoint]:
    return _chart("yearly")


@router.get("/machines/{machine_id}/charts/events/{period}", response_model=list[ChartSeriesPoint])
def chart_machine(machine_id: str, period: str) -> list[ChartSeriesPoint]:
    if period not in {"hourly", "daily", "weekly", "monthly", "yearly"}:
        raise HTTPException(status_code=404, detail="Periodo non valido")
    return _chart(period, machine_id)
