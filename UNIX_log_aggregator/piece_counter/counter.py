#!/usr/bin/env python3
import logging
import signal
import sys
import time
from datetime import datetime, timezone

import RPi.GPIO as GPIO

from piece_counter.config import Settings, load_settings
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


def on_piece_detected(
    channel: int,
    repository: PieceRepository,
    settings: Settings,
    state: dict[str, int],
) -> None:
    ts = datetime.now(timezone.utc)
    state["count"] += 1
    logger.info("Pezzo rilevato su GPIO %s alle %s", channel, ts.isoformat())
    try:
        repository.insert_piece(ts)
        logger.info(
            "Insert completata: macchinario=%s pezzo=%s",
            settings.nome_macchinario,
            settings.nome_pezzo,
        )
        if (
            settings.pezzo_secondario_abilitato
            and state["count"] % settings.pezzo_secondario_ogni_n == 0
        ):
            repository.insert_piece(ts, nome_pezzo=settings.nome_pezzo_secondario)
            logger.info(
                "Insert pezzo secondario: macchinario=%s pezzo=%s (ogni %s pezzi, conteggio=%s)",
                settings.nome_macchinario,
                settings.nome_pezzo_secondario,
                settings.pezzo_secondario_ogni_n,
                state["count"],
            )
    except Exception:
        logger.exception("Impossibile registrare il pezzo su PostgreSQL")


def setup_gpio_pin(pin: int, idle: str) -> None:
    GPIO.setwarnings(False)
    GPIO.cleanup()
    GPIO.setmode(GPIO.BCM)

    if idle == "low":
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
    else:
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)


def poll_edges(pin: int, debounce_ms: int, idle: str, callback) -> None:
    last_state = GPIO.input(pin)
    last_trigger_ms = 0.0

    while running:
        state = GPIO.input(pin)
        now_ms = time.monotonic() * 1000
        edge_detected = False

        if idle == "low":
            edge_detected = last_state == GPIO.LOW and state == GPIO.HIGH
        else:
            edge_detected = last_state == GPIO.HIGH and state == GPIO.LOW

        if edge_detected and now_ms - last_trigger_ms >= debounce_ms:
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
    piece_state = {"count": 0}
    callback = lambda channel: on_piece_detected(
        channel,
        repository,
        settings,
        piece_state,
    )

    try:
        setup_gpio_pin(gpio_pin, settings.gpio_idle)
    except Exception:
        logger.exception("Inizializzazione GPIO fallita")
        repository.close()
        return 1

    edge_label = "0->1" if settings.gpio_idle == "low" else "1->0"
    logger.info(
        "Contatore avviato: macchinario=%s pezzo=%s gpio=%s idle=%s edge=%s (polling)",
        settings.nome_macchinario,
        settings.nome_pezzo,
        gpio_pin,
        settings.gpio_idle,
        edge_label,
    )
    if settings.pezzo_secondario_abilitato:
        logger.info(
            "Pezzo secondario attivo: %s ogni %s pezzi",
            settings.nome_pezzo_secondario,
            settings.pezzo_secondario_ogni_n,
        )

    try:
        poll_edges(gpio_pin, settings.debounce_ms, settings.gpio_idle, callback)
    finally:
        GPIO.cleanup(gpio_pin)
        repository.close()
        logger.info("Contatore terminato")

    return 0


if __name__ == "__main__":
    sys.exit(main())
