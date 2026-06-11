#!/usr/bin/env python3
import logging
import signal
import sys
import time

from aggregator.config import MachineSource, load_settings
from aggregator.db import PieceRepository
from aggregator.mssql_reader import read_new_rows
from aggregator.parser import OffsetStore
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


def _state_key(source: MachineSource) -> str:
    if source.source_type == "mssql":
        return f"{source.id}:mssql:{source.mssql_table}"
    return f"{source.id}:{resolve_log_path(source)}"


def _process_source(
    source: MachineSource,
    repository: PieceRepository,
    offsets: OffsetStore,
) -> int:
    state_key = _state_key(source)
    imported = 0

    if source.source_type == "mssql":
        watermark = offsets.get(state_key, None)
        if watermark == 0:
            watermark = None
        try:
            pieces, new_watermark = read_new_rows(source, watermark)
        except Exception:
            logger.exception(
                "Errore lettura MSSQL per sorgente %s (%s)",
                source.id,
                source.mssql_table,
            )
            return 0
        for piece in pieces:
            if repository.insert_piece(piece, source.id):
                imported += 1
        if new_watermark != watermark:
            offsets.set(state_key, new_watermark)
            logger.info(
                "Sorgente %s (%s): %s nuovi eventi, watermark %s -> %s",
                source.id,
                source.mssql_table,
                len(pieces),
                watermark,
                new_watermark,
            )
        return imported

    start_offset = int(offsets.get(state_key, 0))
    log_path = resolve_log_path(source)
    try:
        pieces, new_offset, log_path = read_new_lines(source, start_offset)
    except Exception:
        logger.exception("Errore lettura SMB per sorgente %s (%s)", source.id, log_path)
        return 0

    for piece in pieces:
        if repository.insert_piece(piece, source.id):
            imported += 1

    if new_offset != start_offset:
        offsets.set(state_key, new_offset)
        logger.info(
            "Sorgente %s (%s): %s nuove righe, offset %s -> %s",
            source.id,
            log_path,
            len(pieces),
            start_offset,
            new_offset,
        )
    return imported


def process_all_sources(settings, repository: PieceRepository, offsets: OffsetStore) -> int:
    imported = 0
    for source in settings.machines:
        imported += _process_source(source, repository, offsets)
    offsets.save()
    return imported


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

    try:
        repository.connect()
    except Exception:
        logger.exception("Connessione iniziale a PostgreSQL fallita")
        return 1

    logger.info(
        "Aggregator avviato: %s macchine, poll ogni %ss",
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
        repository.close()
        logger.info("Aggregator terminato")

    return 0


if __name__ == "__main__":
    sys.exit(main())
