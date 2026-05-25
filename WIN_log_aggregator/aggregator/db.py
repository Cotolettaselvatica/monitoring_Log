import logging

import mariadb

from aggregator.config import DbSettings
from aggregator.parser import ParsedPiece

logger = logging.getLogger(__name__)


class PieceRepository:
    def __init__(self, settings: DbSettings) -> None:
        self._settings = settings
        self._conn = None

    def connect(self) -> None:
        self.close()
        self._conn = mariadb.connect(
            host=self._settings.host,
            port=self._settings.port,
            user=self._settings.user,
            password=self._settings.password,
            database=self._settings.name,
            connect_timeout=10,
        )
        self._conn.autocommit = True
        logger.info(
            "Connesso a MariaDB su %s:%s/%s",
            self._settings.host,
            self._settings.port,
            self._settings.name,
        )

    def close(self) -> None:
        if self._conn is not None:
            self._conn.close()
        self._conn = None

    def ensure_connected(self) -> None:
        if self._conn is None:
            self.connect()

    def insert_piece(self, piece: ParsedPiece, source_id: str) -> bool:
        query = """
            INSERT IGNORE INTO conteggi_pezzi
                (nome_macchinario, nome_pezzo, timestamp, source_id, raw_line)
            VALUES (?, ?, ?, ?, ?)
        """
        params = (
            piece.nome_macchinario,
            piece.nome_pezzo,
            piece.timestamp,
            source_id,
            piece.raw_line,
        )

        try:
            self.ensure_connected()
            cursor = self._conn.cursor()
            try:
                cursor.execute(query, params)
                return cursor.rowcount > 0
            finally:
                cursor.close()
        except mariadb.Error:
            logger.exception("Errore insert, tentativo di riconnessione")
            self.connect()
            cursor = self._conn.cursor()
            try:
                cursor.execute(query, params)
                return cursor.rowcount > 0
            finally:
                cursor.close()
