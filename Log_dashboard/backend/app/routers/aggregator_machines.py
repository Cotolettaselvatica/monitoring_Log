from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas import AggregatorMachine
from app.services import aggregator_machines as aggregator_service

router = APIRouter(prefix="/aggregator-machines", tags=["aggregator-machines"])


@router.get("", response_model=list[AggregatorMachine])
def list_aggregator_machines() -> list[AggregatorMachine]:
    try:
        return aggregator_service.list_aggregator_machines()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Impossibile leggere configurazione macchine aggregator: {exc}",
        ) from exc
