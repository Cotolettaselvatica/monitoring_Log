from __future__ import annotations

import logging
import platform
import re
import subprocess
from datetime import datetime, timezone

from aggregator.config import MachineSource
from aggregator.db import PieceRepository

logger = logging.getLogger(__name__)

_HOST_PATTERN = re.compile(r"^[\d.]+$")


def is_pingable_host(host: str) -> bool:
    host = (host or "").strip()
    if not host or "?" in host:
        return False
    return bool(_HOST_PATTERN.match(host))


def ping_host(host: str, timeout_sec: float = 1.0) -> bool:
    if not is_pingable_host(host):
        return False

    system = platform.system().lower()
    if system == "windows":
        cmd = ["ping", "-n", "1", "-w", str(int(timeout_sec * 1000)), host]
    else:
        wait = str(max(1, int(timeout_sec)))
        cmd = ["ping", "-c", "1", "-W", wait, host]

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout_sec + 1,
            check=False,
        )
        return result.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def run_ping_round(machines: list[MachineSource], repository: PieceRepository) -> int:
    targets = [m for m in machines if m.pingable and is_pingable_host(m.smb_host)]
    if not targets:
        return 0

    checked_at = datetime.now(timezone.utc)
    inserted = 0

    for machine in targets:
        reachable = ping_host(machine.smb_host)
        if repository.insert_ping_check(
            machine.nome_macchinario,
            machine.smb_host,
            reachable,
            checked_at,
        ):
            inserted += 1
        if not reachable:
            logger.debug(
                "Ping fallito: %s (%s)",
                machine.nome_macchinario,
                machine.smb_host,
            )

    return inserted
