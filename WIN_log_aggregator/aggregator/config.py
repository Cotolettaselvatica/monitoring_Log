from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import yaml
from dotenv import load_dotenv


@dataclass(frozen=True)
class DbSettings:
    host: str
    port: int
    name: str
    user: str
    password: str


@dataclass(frozen=True)
class MachineSource:
    id: str
    nome_macchinario: str
    nome_pezzo: str
    source_type: str = "smb"
    # SMB
    smb_host: str = ""
    smb_share: str = ""
    log_path: str = ""
    log_dir: str = ""
    log_file_prefix: str = ""
    log_file_date_format: str = ""
    username: str = ""
    password: str = ""
    domain: str = ""
    # MSSQL
    mssql_host: str = ""
    mssql_port: int = 1433
    mssql_database: str = ""
    mssql_user: str = ""
    mssql_password: str = ""
    mssql_table: str = ""
    mssql_timestamp_column: str = ""
    mssql_time_column: str = ""
    mssql_id_column: str = ""
    mssql_piece_column: str = ""
    mssql_machine_column: str = ""
    mssql_driver: str = "ODBC Driver 18 for SQL Server"
    mssql_lookback_hours: int = 24


@dataclass(frozen=True)
class AggregatorSettings:
    db: DbSettings
    machines: List[MachineSource]
    poll_interval_sec: int
    state_file: Path
    machines_config: Path


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Variabile d'ambiente obbligatoria mancante: {name}")
    return value


def _parse_machine(item: dict) -> MachineSource:
    source_type = str(item.get("source_type", "smb")).strip().lower()
    machine_id = str(item["id"])

    common = dict(
        id=machine_id,
        nome_macchinario=str(item["nome_macchinario"]),
        nome_pezzo=str(item["nome_pezzo"]),
        source_type=source_type,
    )

    if source_type == "mssql":
        missing = [
            key
            for key in (
                "mssql_host",
                "mssql_database",
                "mssql_user",
                "mssql_password",
                "mssql_table",
                "mssql_timestamp_column",
            )
            if not str(item.get(key, "") or "").strip()
        ]
        if missing:
            raise ValueError(
                f"Macchina {machine_id}: source_type mssql richiede {', '.join(missing)}"
            )
        return MachineSource(
            **common,
            mssql_host=str(item["mssql_host"]),
            mssql_port=int(item.get("mssql_port", 1433)),
            mssql_database=str(item["mssql_database"]),
            mssql_user=str(item["mssql_user"]),
            mssql_password=str(item["mssql_password"]),
            mssql_table=str(item["mssql_table"]),
            mssql_timestamp_column=str(item["mssql_timestamp_column"]),
            mssql_time_column=str(item.get("mssql_time_column", "") or ""),
            mssql_id_column=str(item.get("mssql_id_column", "") or ""),
            mssql_piece_column=str(item.get("mssql_piece_column", "") or ""),
            mssql_machine_column=str(item.get("mssql_machine_column", "") or ""),
            mssql_driver=str(
                item.get("mssql_driver", "ODBC Driver 18 for SQL Server")
            ),
            mssql_lookback_hours=int(item.get("mssql_lookback_hours", 24)),
        )

    if source_type != "smb":
        raise ValueError(f"Macchina {machine_id}: source_type non supportato: {source_type}")

    log_dir = str(item.get("log_dir", "") or "").strip().replace("\\", "/")
    log_path = str(item.get("log_path", "") or "").strip().replace("\\", "/")
    log_file_prefix = str(item.get("log_file_prefix", "") or "")
    log_file_date_format = str(item.get("log_file_date_format", "") or "")

    if log_dir:
        if not log_file_date_format:
            raise ValueError(
                f"Macchina {machine_id}: log_dir richiede log_file_date_format"
            )
    elif not log_path:
        raise ValueError(
            f"Macchina {machine_id}: serve log_path oppure source_type mssql"
        )

    for key in ("smb_host", "smb_share", "username", "password"):
        if not str(item.get(key, "") or "").strip():
            raise ValueError(f"Macchina {machine_id}: campo SMB obbligatorio mancante: {key}")

    return MachineSource(
        **common,
        smb_host=str(item["smb_host"]),
        smb_share=str(item["smb_share"]),
        log_path=log_path,
        log_dir=log_dir,
        log_file_prefix=log_file_prefix,
        log_file_date_format=log_file_date_format,
        username=str(item["username"]),
        password=str(item["password"]),
        domain=str(item.get("domain", "")),
    )


def _load_machines(config_path: Path) -> List[MachineSource]:
    with config_path.open(encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)

    machines = raw.get("machines", [])
    if not machines:
        raise ValueError(f"Nessuna macchina definita in {config_path}")

    return [_parse_machine(item) for item in machines]


def load_settings(
    env_file: Optional[str] = None,
    machines_file: Optional[str] = None,
) -> AggregatorSettings:
    if env_file:
        load_dotenv(env_file)
    else:
        load_dotenv(os.getenv("AGGREGATOR_ENV", ".env"))
        load_dotenv()

    base_dir = Path(os.getenv("AGGREGATOR_BASE_DIR", Path.cwd()))
    machines_config = Path(
        machines_file or os.getenv("MACHINES_CONFIG", "config/machines.yaml")
    )
    state_file = Path(os.getenv("STATE_FILE", "state/offsets.json"))

    if not machines_config.is_absolute():
        machines_config = base_dir / machines_config
    if not state_file.is_absolute():
        state_file = base_dir / state_file

    return AggregatorSettings(
        db=DbSettings(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            name=_require("DB_NAME"),
            user=_require("DB_USER"),
            password=_require("DB_PASSWORD"),
        ),
        machines=_load_machines(machines_config),
        poll_interval_sec=int(os.getenv("POLL_INTERVAL_SEC", "30")),
        state_file=state_file,
        machines_config=machines_config,
    )
