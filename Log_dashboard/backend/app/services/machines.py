from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app import db
from app.config import load_settings
from app.schemas import Machine, MachineInput, MachineStatus
from app.services.pieces import distinct_machines_from_production
from app.services.utils import (
    compute_status,
    get_settings_row,
    iso,
    machine_id_from_name,
    new_id,
    offline_threshold_min,
)


def _default_name(nome: str) -> str:
    return nome.replace("_", " ")


def sync_discovered_machines() -> None:
    discovered = distinct_machines_from_production()
    for row in discovered:
        nome = row["nome_macchinario"]
        existing = db.fetch_one(
            "SELECT id FROM dashboard_macchinari WHERE nome_macchinario = %s",
            (nome,),
        )
        if existing:
            continue
        machine_id = machine_id_from_name(nome)
        code = nome[:32]
        db.execute(
            """
            INSERT INTO dashboard_macchinari (
                id, nome_macchinario, name, code, department, location
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (nome_macchinario) DO NOTHING
            """,
            (
                machine_id,
                nome,
                _default_name(nome),
                code,
                "Produzione",
                "Reparto produzione",
            ),
        )


def _row_to_machine(row: dict, last_seen: datetime | None) -> Machine:
    settings = get_settings_row()
    gateway = settings.get("rdp_gateway_url") or "https://guacamole.local/guacamole"
    status = compute_status(
        last_seen,
        int(settings.get("offline_threshold_min") or 15),
        row.get("status_override"),
    )
    code = row["code"]
    rdp_url = row.get("rdp_url") or f"{gateway}/#/client/{code}"
    public_base = load_settings().public_base_url
    image_url = row.get("image_url")
    if image_url and image_url.startswith("/"):
        image_url = f"{public_base}{image_url}"

    return Machine(
        id=row["id"],
        name=row["name"],
        code=code,
        type=row["type"],
        location=row.get("location") or "",
        department=row.get("department"),
        line=row.get("line"),
        status=status,
        ipAddress=row.get("ip_address") or "",
        lastSeen=iso(last_seen),
        interconnected=bool(row.get("interconnected", True)),
        rdpUrl=rdp_url,
        imageUrl=image_url,
    )


def list_machines() -> list[Machine]:
    sync_discovered_machines()
    rows = db.fetch_all(
        """
        SELECT dm.*,
               stats.last_seen
        FROM dashboard_macchinari dm
        LEFT JOIN (
            SELECT nome_macchinario, MAX(timestamp) AS last_seen
            FROM conteggi_pezzi
            GROUP BY nome_macchinario
        ) stats ON stats.nome_macchinario = dm.nome_macchinario
        ORDER BY dm.name
        """
    )
    return [_row_to_machine(row, row.get("last_seen")) for row in rows]


def get_machine(machine_id: str) -> Machine | None:
    sync_discovered_machines()
    row = db.fetch_one(
        """
        SELECT dm.*,
               stats.last_seen
        FROM dashboard_macchinari dm
        LEFT JOIN (
            SELECT nome_macchinario, MAX(timestamp) AS last_seen
            FROM conteggi_pezzi
            GROUP BY nome_macchinario
        ) stats ON stats.nome_macchinario = dm.nome_macchinario
        WHERE dm.id = %s
        """,
        (machine_id,),
    )
    if not row:
        return None
    return _row_to_machine(row, row.get("last_seen"))


def create_machine(data: MachineInput) -> Machine:
    nome = data.code or data.name
    machine_id = machine_id_from_name(nome)
    db.execute_returning(
        """
        INSERT INTO dashboard_macchinari (
            id, nome_macchinario, name, code, type, location, department, line,
            status_override, ip_address, interconnected, rdp_url, image_url
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (
            machine_id,
            nome,
            data.name,
            data.code,
            data.type,
            data.location or "",
            data.department,
            data.line,
            data.status,
            data.ipAddress,
            data.interconnected,
            data.rdpUrl,
            data.imageUrl,
        ),
    )
    machine = get_machine(machine_id)
    assert machine is not None
    return machine


def update_machine(machine_id: str, data: MachineInput) -> Machine | None:
    row = db.execute_returning(
        """
        UPDATE dashboard_macchinari SET
            name = %s,
            code = %s,
            type = %s,
            location = %s,
            department = %s,
            line = %s,
            status_override = %s,
            ip_address = %s,
            interconnected = %s,
            rdp_url = %s,
            image_url = %s,
            updated_at = NOW()
        WHERE id = %s
        RETURNING id
        """,
        (
            data.name,
            data.code,
            data.type,
            data.location or "",
            data.department,
            data.line,
            data.status,
            data.ipAddress,
            data.interconnected,
            data.rdpUrl,
            data.imageUrl,
            machine_id,
        ),
    )
    if not row:
        return None
    return get_machine(machine_id)


def patch_machine_status(machine_id: str, status: MachineStatus) -> Machine | None:
    row = db.execute_returning(
        """
        UPDATE dashboard_macchinari
        SET status_override = %s, updated_at = NOW()
        WHERE id = %s
        RETURNING id
        """,
        (status, machine_id),
    )
    if not row:
        return None
    return get_machine(machine_id)


def delete_machine(machine_id: str) -> bool:
    row = db.execute_returning(
        "DELETE FROM dashboard_macchinari WHERE id = %s RETURNING id",
        (machine_id,),
    )
    return row is not None


def update_machine_image(machine_id: str, image_url: str | None) -> Machine | None:
    row = db.execute_returning(
        """
        UPDATE dashboard_macchinari
        SET image_url = %s, updated_at = NOW()
        WHERE id = %s
        RETURNING id
        """,
        (image_url, machine_id),
    )
    if not row:
        return None
    return get_machine(machine_id)


def get_nome_macchinario(machine_id: str) -> str | None:
    row = db.fetch_one(
        "SELECT nome_macchinario FROM dashboard_macchinari WHERE id = %s",
        (machine_id,),
    )
    return row["nome_macchinario"] if row else None
