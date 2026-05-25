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


def setup_gpio_pin(pin: int) -> None:
    GPIO.setwarnings(False)
    GPIO.cleanup()
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)


def poll_falling_edges(pin: int, debounce_ms: int, callback) -> None:
    last_state = GPIO.input(pin)
    last_trigger_ms = 0.0

    while running:
        state = GPIO.input(pin)
        now_ms = time.monotonic() * 1000

        if last_state == GPIO.HIGH and state == GPIO.LOW:
            if now_ms - last_trigger_ms >= debounce_ms:
                last_trigger_ms = now_ms
                callback(pin)

        last_state = state
        time.sleep(0.001)


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

    gpio_pin = settings.gpio_pin
    callback = lambda channel: on_falling_edge(
        channel,
        repository,
        settings.nome_macchinario,
        settings.nome_pezzo,
    )

    try:
        setup_gpio_pin(gpio_pin)
    except Exception:
        logger.exception("Inizializzazione GPIO fallita")
        repository.close()
        return 1

    logger.info(
        "Contatore avviato: macchinario=%s pezzo=%s gpio=%s (polling)",
        settings.nome_macchinario,
        settings.nome_pezzo,
        gpio_pin,
    )

    try:
        poll_falling_edges(gpio_pin, settings.debounce_ms, callback)
    finally:
        GPIO.cleanup(gpio_pin)
        repository.close()
        logger.info("Contatore terminato")

    return 0


if __name__ == "__main__":
    sys.exit(main())
