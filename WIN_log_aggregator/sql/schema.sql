CREATE TABLE IF NOT EXISTS conteggi_pezzi (
    id BIGSERIAL PRIMARY KEY,
    nome_macchinario TEXT NOT NULL,
    nome_pezzo TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conteggi_pezzi_macchinario_ts
    ON conteggi_pezzi (nome_macchinario, timestamp DESC);

CREATE TABLE IF NOT EXISTS ping_checks (
    id BIGSERIAL PRIMARY KEY,
    nome_macchinario TEXT NOT NULL,
    ip TEXT NOT NULL,
    reachable BOOLEAN NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ping_checks
    ADD COLUMN IF NOT EXISTS reachable BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ping_checks_macchina_ts
    ON ping_checks (nome_macchinario, timestamp DESC);

GRANT INSERT, SELECT ON ping_checks TO counter;
GRANT USAGE, SELECT ON SEQUENCE ping_checks_id_seq TO counter;
