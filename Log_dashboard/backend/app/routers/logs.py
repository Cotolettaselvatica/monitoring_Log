from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas import LogEntry
from app.services import machines as machine_service
from app.services import pieces as pieces_service

router = APIRouter(tags=["logs"])


@router.get("/logs", response_model=list[LogEntry])
def list_logs(limit: int = 2000) -> list[LogEntry]:
    return pieces_service.list_logs(limit=limit)


@router.get("/machines/{machine_id}/logs", response_model=list[LogEntry])
def list_machine_logs(machine_id: str, limit: int = 2000) -> list[LogEntry]:
    if not machine_service.get_machine(machine_id):
        raise HTTPException(status_code=404, detail="Macchinario non trovato")
    return pieces_service.list_logs_for_machine_id(machine_id, limit=limit)
