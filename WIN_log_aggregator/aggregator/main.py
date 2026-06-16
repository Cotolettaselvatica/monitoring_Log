#!/usr/bin/env python3
import logging
import signal
import sys
import threading
import time

from aggregator.config import load_settings
from aggregator.db import PieceRepository
from aggregator.parser import OffsetStore
from aggregator.ping import run_ping_round
from aggregator.smb_reader import read_new_lines, resolve_log_path

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


def process_all_sources(settings, repository: PieceRepository, offsets: OffsetStore) -> int:
    imported = 0

    for source in settings.machines:
        log_path = resolve_log_path(source)
        offset_key = f"{source.id}:{log_path}"
        start_offset = offsets.get(offset_key)
        try:
            pieces, new_offset, log_path = read_new_lines(source, start_offset)
        except Exception:
            logger.exception("Errore lettura SMB per sorgente %s (%s)", source.id, log_path)
            continue

        for piece in pieces:
            if repository.insert_piece(piece, source.id):
                imported += 1

        if new_offset != start_offset:
            offsets.set(offset_key, new_offset)
            logger.info(
                "Sorgente %s (%s): %s nuove righe, offset %s -> %s",
                source.id,
                log_path,
                len(pieces),
                start_offset,
                new_offset,
            )

    offsets.save()
    return imported


def ping_worker(settings, repository: PieceRepository, stop_event: threading.Event) -> None:
    pingable = [m for m in settings.machines if m.pingable]
    logger.info(
        "Ping monitor avviato: %s macchine pingable, intervallo %ss",
        len(pingable),
        settings.ping_interval_sec,
    )

    while running and not stop_event.is_set():
        started = time.monotonic()
        try:
            inserted = run_ping_round(settings.machines, repository)
            if inserted:
                logger.debug("Registrati %s ping riusciti", inserted)
        except Exception:
            logger.exception("Errore nel ciclo ping")

        elapsed = time.monotonic() - started
        wait_sec = max(0.0, settings.ping_interval_sec - elapsed)
        stop_event.wait(wait_sec)


def main() -> int:
    setup_logging()
    signal.signal(signal.SIGINT, stop_handler)
    signal.signal(signal.SIGTERM, stop_handler)

    try:
        settings = load_settings()
    except ValueError as exc:
        logger.error("%s", exc)
        return 1

    repository = PieceRepository(settings.db)
    offsets = OffsetStore(settings.state_file)
    ping_stop = threading.Event()
    ping_thread: threading.Thread | None = None

    try:
        repository.connect()
    except Exception:
        logger.exception("Connessione iniziale a PostgreSQL fallita")
        return 1

    pingable_count = sum(1 for machine in settings.machines if machine.pingable)
    if settings.ping_interval_sec > 0 and pingable_count > 0:
        ping_thread = threading.Thread(
            target=ping_worker,
            args=(settings, repository, ping_stop),
            name="ping-monitor",
            daemon=True,
        )
        ping_thread.start()

    logger.info(
        "Aggregator avviato: %s macchine SMB, poll ogni %ss",
        len(settings.machines),
        settings.poll_interval_sec,
    )

    try:
        while running:
            imported = process_all_sources(settings, repository, offsets)
            if imported:
                logger.info("Importate %s righe in PostgreSQL", imported)
            time.sleep(settings.poll_interval_sec)
    finally:
        ping_stop.set()
        if ping_thread is not None:
            ping_thread.join(timeout=settings.ping_interval_sec + 2)
        repository.close()
        logger.info("Aggregator terminato")

    return 0


if __name__ == "__main__":
    sys.exit(main())
