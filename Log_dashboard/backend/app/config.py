from dataclasses import dataclass
from pathlib import Path
from typing import List

from dotenv import load_dotenv
import os

load_dotenv()


@dataclass(frozen=True)
class Settings:
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    api_host: str
    api_port: int
    cors_origins: List[str]
    upload_dir: Path
    public_base_url: str
    aggregator_machines_config: Path


def _split_origins(value: str) -> List[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def _default_aggregator_machines_config(backend_root: Path) -> Path:
    env_path = os.getenv("AGGREGATOR_MACHINES_CONFIG")
    if env_path:
        path = Path(env_path)
        if not path.is_absolute():
            path = backend_root / path
        return path

    prod_yaml = Path("/opt/win-log-aggregator/config/machines.yaml")
    if prod_yaml.is_file():
        return prod_yaml

    repo_root = backend_root.parent.parent
    example_yaml = repo_root / "WIN_log_aggregator" / "config" / "machines.example.yaml"
    if example_yaml.is_file():
        return example_yaml

    return prod_yaml


def load_settings() -> Settings:
    backend_root = Path(__file__).resolve().parents[1]
    upload_dir = Path(os.getenv("UPLOAD_DIR", "uploads"))
    if not upload_dir.is_absolute():
        upload_dir = backend_root / upload_dir

    aggregator_machines_config = _default_aggregator_machines_config(backend_root)

    return Settings(
        db_host=os.getenv("DB_HOST", "localhost"),
        db_port=int(os.getenv("DB_PORT", "5432")),
        db_name=os.getenv("DB_NAME", "raspberry_counter"),
        db_user=os.getenv("DB_USER", "counter"),
        db_password=os.getenv("DB_PASSWORD", ""),
        api_host=os.getenv("API_HOST", "0.0.0.0"),
        api_port=int(os.getenv("API_PORT", "8000")),
        cors_origins=_split_origins(
            os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
        ),
        upload_dir=upload_dir,
        public_base_url=os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/"),
        aggregator_machines_config=aggregator_machines_config,
    )
