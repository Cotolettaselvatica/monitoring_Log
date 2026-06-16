import os
from dataclasses import dataclass

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    nome_macchinario: str
    nome_pezzo: str
    nome_pezzo_secondario: str | None
    pezzo_secondario_ogni_n: int
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    gpio_pin: int
    gpio_idle: str
    debounce_ms: int

    @property
    def pezzo_secondario_abilitato(self) -> bool:
        return self.pezzo_secondario_ogni_n > 0 and bool(self.nome_pezzo_secondario)


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

    settings = Settings(
        nome_macchinario=_require("NOME_MACCHINARIO"),
        nome_pezzo=_require("NOME_PEZZO"),
        nome_pezzo_secondario=os.getenv("NOME_PEZZO_SECONDARIO", "").strip() or None,
        pezzo_secondario_ogni_n=int(os.getenv("PEZZO_SECONDARIO_OGNI_N", "0")),
        db_host=os.getenv("DB_HOST", "localhost"),
        db_port=int(os.getenv("DB_PORT", "5432")),
        db_name=_require("DB_NAME"),
        db_user=_require("DB_USER"),
        db_password=_require("DB_PASSWORD"),
        gpio_pin=int(os.getenv("GPIO_PIN", "10")),
        gpio_idle=_parse_gpio_idle(os.getenv("GPIO_IDLE", "high")),
        debounce_ms=int(os.getenv("DEBOUNCE_MS", "200")),
    )

    if settings.pezzo_secondario_ogni_n < 0:
        raise ValueError("PEZZO_SECONDARIO_OGNI_N deve essere >= 0 (0 = disabilitato)")
    if settings.pezzo_secondario_ogni_n > 0 and not settings.nome_pezzo_secondario:
        raise ValueError(
            "PEZZO_SECONDARIO_OGNI_N > 0 richiede NOME_PEZZO_SECONDARIO in configurazione"
        )

    return settings
