-- Estensione tabella condivisa con UNIX_log_aggregator (PostgreSQL)
-- Esegui sul database raspberry_counter:
--   psql -U counter -d raspberry_counter -h 172.20.1.84 -f sql/schema.sql

CREATE TABLE IF NOT EXISTS conteggi_pezzi (
    id BIGSERIAL PRIMARY KEY,
    nome_macchinario TEXT NOT NULL,
    nome_pezzo TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conteggi_pezzi ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE conteggi_pezzi ADD COLUMN IF NOT EXISTS raw_line TEXT;
ALTER TABLE conteggi_pezzi ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_conteggi_pezzi_macchinario_ts
    ON conteggi_pezzi (nome_macchinario, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conteggi_pezzi_source_ts
    ON conteggi_pezzi (source_id, timestamp DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_conteggi_pezzi_source_raw_line
    ON conteggi_pezzi (source_id, raw_line);

GRANT INSERT, SELECT ON conteggi_pezzi TO counter;
GRANT USAGE, SELECT ON SEQUENCE conteggi_pezzi_id_seq TO counter;
