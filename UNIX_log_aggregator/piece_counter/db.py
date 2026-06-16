import logging
from datetime import datetime, timezone

import psycopg2
from psycopg2 import sql

from piece_counter.config import Settings

logger = logging.getLogger(__name__)


class PieceRepository:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._conn = None

    def connect(self) -> None:
        self.close()
        self._conn = psycopg2.connect(
            host=self._settings.db_host,
            port=self._settings.db_port,
            dbname=self._settings.db_name,
            user=self._settings.db_user,
            password=self._settings.db_password,
            connect_timeout=10,
        )
        self._conn.autocommit = True
        logger.info("Connesso a PostgreSQL su %s:%s", self._settings.db_host, self._settings.db_port)

    def close(self) -> None:
        if self._conn is not None and not self._conn.closed:
            self._conn.close()
        self._conn = None

    def ensure_connected(self) -> None:
        if self._conn is None or self._conn.closed:
            self.connect()

    def insert_piece(
        self,
        timestamp: datetime | None = None,
        *,
        nome_pezzo: str | None = None,
    ) -> None:
        ts = timestamp or datetime.now(timezone.utc)
        pezzo = nome_pezzo or self._settings.nome_pezzo
        query = sql.SQL(
            """
            INSERT INTO conteggi_pezzi (nome_macchinario, nome_pezzo, timestamp)
            VALUES (%s, %s, %s)
            """
        )
        params = (self._settings.nome_macchinario, pezzo, ts)

        try:
            self.ensure_connected()
            with self._conn.cursor() as cur:
                cur.execute(query, params)
        except psycopg2.Error:
            logger.exception("Errore durante l'insert, tentativo di riconnessione")
            self.connect()
            with self._conn.cursor() as cur:
                cur.execute(query, params)
