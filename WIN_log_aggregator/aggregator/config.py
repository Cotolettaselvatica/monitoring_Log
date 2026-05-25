import os
from dataclasses import dataclass
from pathlib import Path

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
    smb_host: str
    smb_share: str
    log_path: str
    username: str
    password: str
    nome_macchinario: str
    nome_pezzo: str
    domain: str = ""


@dataclass(frozen=True)
class AggregatorSettings:
    db: DbSettings
    machines: list[MachineSource]
    poll_interval_sec: int
    state_file: Path
    machines_config: Path


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Variabile d'ambiente obbligatoria mancante: {name}")
    return value


def _load_machines(config_path: Path) -> list[MachineSource]:
    with config_path.open(encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)

    machines = raw.get("machines", [])
    if not machines:
        raise ValueError(f"Nessuna macchina definita in {config_path}")

    result: list[MachineSource] = []
    for item in machines:
        result.append(
            MachineSource(
                id=str(item["id"]),
                smb_host=str(item["smb_host"]),
                smb_share=str(item["smb_share"]),
                log_path=str(item["log_path"]),
                username=str(item["username"]),
                password=str(item["password"]),
                nome_macchinario=str(item["nome_macchinario"]),
                nome_pezzo=str(item["nome_pezzo"]),
                domain=str(item.get("domain", "")),
            )
        )
    return result


def load_settings(
    env_file: str | None = None,
    machines_file: str | None = None,
) -> AggregatorSettings:
    if env_file:
        load_dotenv(env_file)
    else:
        load_dotenv(os.getenv("AGGREGATOR_ENV", ".env"))
        load_dotenv()

    base_dir = Path(os.getenv("AGGREGATOR_BASE_DIR", Path.cwd()))
    machines_config = Path(
        machines_file or os.getenv("MACHINES_CONFIG", base_dir / "config" / "machines.yaml")
    )
    state_file = Path(os.getenv("STATE_FILE", base_dir / "state" / "offsets.json"))

    return AggregatorSettings(
        db=DbSettings(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "3306")),
            name=_require("DB_NAME"),
            user=_require("DB_USER"),
            password=_require("DB_PASSWORD"),
        ),
        machines=_load_machines(machines_config),
        poll_interval_sec=int(os.getenv("POLL_INTERVAL_SEC", "30")),
        state_file=state_file,
        machines_config=machines_config,
    )
