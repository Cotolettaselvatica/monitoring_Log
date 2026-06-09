#!/usr/bin/env python3
from __future__ import annotations

import argparse
import logging
import signal
import sys
import time

from sync_supabase.config import load_settings
from sync_supabase.runner import run_once

logger = logging.getLogger(__name__)
running = True


def setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def stop_handler(signum, frame) -> None:
    global running
    logger.info("Segnale %s ricevuto, chiusura...", signum)
    running = False


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync PostgreSQL LAN → Supabase")
    parser.add_argument("--once", action="store_true", help="Esegui un solo ciclo e termina")
    parser.add_argument("--env", help="Percorso file .env")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    setup_logging(args.verbose)
    settings = load_settings(args.env)

    if args.once:
        run_once(settings)
        return 0

    signal.signal(signal.SIGTERM, stop_handler)
    signal.signal(signal.SIGINT, stop_handler)

    logger.info(
        "Avvio sync LAN→Supabase ogni %ss (sorgente %s:%s/%s)",
        settings.sync_interval_sec,
        settings.source.host,
        settings.source.port,
        settings.source.name,
    )

    while running:
        try:
            run_once(settings)
        except Exception:
            logger.exception("Errore durante il sync, riprovo al prossimo ciclo")
        for _ in range(settings.sync_interval_sec):
            if not running:
                break
            time.sleep(1)

    logger.info("Sync terminato")
    return 0


if __name__ == "__main__":
    sys.exit(main())
