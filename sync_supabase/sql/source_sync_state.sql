-- Stato sync sul database sorgente (LAN). Non replicare su Supabase.
CREATE TABLE IF NOT EXISTS sync_supabase_state (
    table_name TEXT PRIMARY KEY,
    last_bigint BIGINT NOT NULL DEFAULT 0,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO sync_supabase_state (table_name, last_bigint)
VALUES ('conteggi_pezzi', 0)
ON CONFLICT (table_name) DO NOTHING;
