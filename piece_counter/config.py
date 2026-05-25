import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    nome_macchinario: str
    nome_pezzo: str
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    gpio_pin: int
    gpio_idle: str
    debounce_ms: int


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise ValueError(f"Variabile d'ambiente obbligatoria mancante: {name}")
    return value


def _parse_gpio_idle(value: str) -> str:
    normalized = value.strip().lower()
    if normalized in ("high", "1", "h"):
        return "high"
    if normalized in ("low", "0", "l"):
        return "low"
    raise ValueError(
        "GPIO_IDLE non valido: usa 'high' (riposo=1, conta su 1->0) "
        "oppure 'low' (riposo=0, conta su 0->1)"
    )


def load_settings(env_file: str | None = None) -> Settings:
    if env_file:
        load_dotenv(env_file)
    else:
        load_dotenv(os.getenv("PIECE_COUNTER_ENV", "/etc/piece-counter.env"))
        load_dotenv()

    return Settings(
        nome_macchinario=_require("NOME_MACCHINARIO"),
        nome_pezzo=_require("NOME_PEZZO"),
        db_host=os.getenv("DB_HOST", "localhost"),
        db_port=int(os.getenv("DB_PORT", "5432")),
        db_name=_require("DB_NAME"),
        db_user=_require("DB_USER"),
        db_password=_require("DB_PASSWORD"),
        gpio_pin=int(os.getenv("GPIO_PIN", "10")),
        gpio_idle=_parse_gpio_idle(os.getenv("GPIO_IDLE", "high")),
        debounce_ms=int(os.getenv("DEBOUNCE_MS", "200")),
    )
