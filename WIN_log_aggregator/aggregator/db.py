import logging

import psycopg2

from aggregator.config import DbSettings
from aggregator.parser import ParsedPiece

logger = logging.getLogger(__name__)


class PieceRepository:
    def __init__(self, settings: DbSettings) -> None:
        self._settings = settings
        self._conn = None

    def connect(self) -> None:
        self.close()
        self._conn = psycopg2.connect(
            host=self._settings.host,
            port=self._settings.port,
            dbname=self._settings.name,
            user=self._settings.user,
            password=self._settings.password,
            connect_timeout=10,
        )
        self._conn.autocommit = True
        logger.info(
            "Connesso a PostgreSQL su %s:%s/%s",
            self._settings.host,
            self._settings.port,
            self._settings.name,
        )

    def close(self) -> None:
        if self._conn is not None and not self._conn.closed:
            self._conn.close()
        self._conn = None

    def ensure_connected(self) -> None:
        if self._conn is None or self._conn.closed:
            self.connect()

    def insert_piece(self, piece: ParsedPiece, source_id: str) -> bool:
        query = """
            INSERT INTO conteggi_pezzi (nome_macchinario, nome_pezzo, timestamp)
            VALUES (%s, %s, %s)
            RETURNING id
        """
        params = (
            piece.nome_macchinario,
            piece.nome_pezzo,
            piece.timestamp,
        )

        try:
            self.ensure_connected()
            with self._conn.cursor() as cursor:
                cursor.execute(query, params)
                return cursor.fetchone() is not None
        except psycopg2.Error:
            logger.exception("Errore insert, tentativo di riconnessione")
            self.connect()
            with self._conn.cursor() as cursor:
                cursor.execute(query, params)
                return cursor.fetchone() is not None
