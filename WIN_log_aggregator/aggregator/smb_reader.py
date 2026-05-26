from __future__ import annotations

import logging
from typing import List, Tuple

import smbclient

from aggregator.config import MachineSource
from aggregator.parser import ParsedPiece, parse_log_line

logger = logging.getLogger(__name__)


def _smb_unc(source: MachineSource) -> str:
    return rf"\\{source.smb_host}\{source.smb_share}\{source.log_path}"


def _register_session(source: MachineSource) -> None:
    kwargs = {
        "username": source.username,
        "password": source.password,
        "auth_protocol": "ntlm",
    }
    if source.domain:
        kwargs["domain"] = source.domain

    smbclient.register_session(source.smb_host, **kwargs)


def read_new_lines(source: MachineSource, start_offset: int) -> Tuple[List[ParsedPiece], int]:
    unc_path = _smb_unc(source)
    _register_session(source)

    with smbclient.open_file(unc_path, mode="rb") as handle:
        handle.seek(start_offset)
        raw = handle.read()
        new_offset = handle.tell()

    if not raw:
        return [], new_offset

    text = raw.decode("utf-8", errors="replace")
    pieces: List[ParsedPiece] = []

    for line in text.splitlines():
        parsed = parse_log_line(
            line,
            default_macchinario=source.nome_macchinario,
            default_pezzo=source.nome_pezzo,
        )
        if parsed is not None:
            pieces.append(parsed)

    if not text.endswith("\n"):
        trailing = text.rsplit("\n", 1)[-1]
        new_offset -= len(trailing.encode("utf-8", errors="replace"))
        logger.debug(
            "Ultima riga incompleta su %s, offset riportato a %s",
            source.id,
            new_offset,
        )

    return pieces, new_offset
