from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import load_settings
from app.schemas import Machine, MachineInput, MachineStatusPatch
from app.services import machines as machine_service

router = APIRouter(prefix="/machines", tags=["machines"])


@router.get("", response_model=list[Machine])
def list_machines() -> list[Machine]:
    return machine_service.list_machines()


@router.get("/{machine_id}", response_model=Machine)
def get_machine(machine_id: str) -> Machine:
    machine = machine_service.get_machine(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Macchinario non trovato")
    return machine


@router.post("", response_model=Machine, status_code=201)
def create_machine(payload: MachineInput) -> Machine:
    return machine_service.create_machine(payload)


@router.put("/{machine_id}", response_model=Machine)
def update_machine(machine_id: str, payload: MachineInput) -> Machine:
    machine = machine_service.update_machine(machine_id, payload)
    if not machine:
        raise HTTPException(status_code=404, detail="Macchinario non trovato")
    return machine


@router.delete("/{machine_id}", status_code=204)
def delete_machine(machine_id: str) -> None:
    if not machine_service.delete_machine(machine_id):
        raise HTTPException(status_code=404, detail="Macchinario non trovato")


@router.patch("/{machine_id}", response_model=Machine)
def patch_machine_status(machine_id: str, payload: MachineStatusPatch) -> Machine:
    machine = machine_service.patch_machine_status(machine_id, payload.status)
    if not machine:
        raise HTTPException(status_code=404, detail="Macchinario non trovato")
    return machine


@router.post("/{machine_id}/image", response_model=Machine)
async def upload_machine_image(machine_id: str, file: UploadFile = File(...)) -> Machine:
    settings = load_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    suffix = (file.filename or "image.bin").split(".")[-1]
    filename = f"{machine_id}.{suffix}"
    dest = settings.upload_dir / filename
    content = await file.read()
    dest.write_bytes(content)
    image_url = f"/uploads/{filename}"
    machine = machine_service.update_machine_image(machine_id, image_url)
    if not machine:
        raise HTTPException(status_code=404, detail="Macchinario non trovato")
    return machine


@router.delete("/{machine_id}/image", response_model=Machine)
def delete_machine_image(machine_id: str) -> Machine:
    machine = machine_service.update_machine_image(machine_id, None)
    if not machine:
        raise HTTPException(status_code=404, detail="Macchinario non trovato")
    return machine
