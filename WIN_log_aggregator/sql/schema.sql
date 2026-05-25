CREATE TABLE IF NOT EXISTS conteggi_pezzi (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nome_macchinario VARCHAR(255) NOT NULL,
    nome_pezzo VARCHAR(255) NOT NULL,
    timestamp DATETIME(6) NOT NULL,
    source_id VARCHAR(128) NOT NULL,
    raw_line VARCHAR(1024) NOT NULL,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_source_raw_line (source_id, raw_line(255))
);

CREATE INDEX idx_conteggi_pezzi_macchinario_ts
    ON conteggi_pezzi (nome_macchinario, timestamp DESC);

CREATE INDEX idx_conteggi_pezzi_source_ts
    ON conteggi_pezzi (source_id, timestamp DESC);
