#!/usr/bin/env python3
import logging
import signal
import sys
import time
from datetime import datetime, timezone

import RPi.GPIO as GPIO

from piece_counter.config import load_settings
from piece_counter.db import PieceRepository

logger = logging.getLogger(__name__)
running = True


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def stop_handler(signum, frame) -> None:
    global running
    logger.info("Segnale %s ricevuto, chiusura in corso...", signum)
    running = False


def on_falling_edge(
    channel: int,
    repository: PieceRepository,
    nome_macchinario: str,
    nome_pezzo: str,
) -> None:
    ts = datetime.now(timezone.utc)
    logger.info("Pezzo rilevato su GPIO %s alle %s", channel, ts.isoformat())
    try:
        repository.insert_piece(ts)
        logger.info(
            "Insert completata: macchinario=%s pezzo=%s",
            nome_macchinario,
            nome_pezzo,
        )
    except Exception:
        logger.exception("Impossibile registrare il pezzo su PostgreSQL")


def main() -> int:
    setup_logging()
    signal.signal(signal.SIGINT, stop_handler)
    signal.signal(signal.SIGTERM, stop_handler)

    try:
        settings = load_settings()
    except ValueError as exc:
        logger.error("%s", exc)
        return 1

    repository = PieceRepository(settings)

    try:
        repository.connect()
    except Exception:
        logger.exception("Connessione iniziale a PostgreSQL fallita")
        return 1

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(settings.gpio_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

    GPIO.add_event_detect(
        settings.gpio_pin,
        GPIO.FALLING,
        callback=lambda channel: on_falling_edge(
            channel,
            repository,
            settings.nome_macchinario,
            settings.nome_pezzo,
        ),
        bouncetime=settings.debounce_ms,
    )

    logger.info(
        "Contatore avviato: macchinario=%s pezzo=%s gpio=%s",
        settings.nome_macchinario,
        settings.nome_pezzo,
        settings.gpio_pin,
    )

    try:
        while running:
            time.sleep(1)
    finally:
        GPIO.cleanup(settings.gpio_pin)
        repository.close()
        logger.info("Contatore terminato")

    return 0


if __name__ == "__main__":
    sys.exit(main())
