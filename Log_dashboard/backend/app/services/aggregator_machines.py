from __future__ import annotations

from pathlib import Path

import yaml

from app.config import load_settings
from app.schemas import AggregatorMachine


def _resolve_config_path() -> Path:
    settings = load_settings()
    if settings.aggregator_machines_config.is_file():
        return settings.aggregator_machines_config
    raise FileNotFoundError(
        f"File macchine aggregator non trovato: {settings.aggregator_machines_config}"
    )


def list_aggregator_machines() -> list[AggregatorMachine]:
    config_path = _resolve_config_path()
    with config_path.open(encoding="utf-8") as handle:
        raw = yaml.safe_load(handle) or {}

    result: list[AggregatorMachine] = []
    for item in raw.get("machines", []):
        if not item or not item.get("id"):
            continue

        connected = bool(item.get("connected", False))
        domain = str(item.get("domain", "") or "").strip() or None

        result.append(
            AggregatorMachine(
                id=str(item["id"]),
                smbHost=str(item.get("smb_host", "") or ""),
                connected=connected,
                username=str(item.get("username", "") or "") or None if connected else None,
                password=str(item.get("password", "") or "") or None if connected else None,
                domain=domain if connected else None,
                nomeMacchinario=str(item.get("nome_macchinario") or item["id"]),
                nomePezzo=str(item.get("nome_pezzo", "") or ""),
            )
        )

    result.sort(key=lambda machine: (not machine.connected, machine.nomeMacchinario.lower()))
    return result
