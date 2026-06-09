-- Schema completo su Supabase (mirror del database LAN).
-- Applica con: ./apply-supabase-schema.sh

CREATE TABLE IF NOT EXISTS conteggi_pezzi (
    id BIGSERIAL PRIMARY KEY,
    nome_macchinario TEXT NOT NULL,
    nome_pezzo TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conteggi_pezzi_macchinario_ts
    ON conteggi_pezzi (nome_macchinario, timestamp DESC);

CREATE TABLE IF NOT EXISTS dashboard_macchinari (
    id TEXT PRIMARY KEY,
    nome_macchinario TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Macchinario produzione',
    location TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    line TEXT,
    status_override TEXT CHECK (status_override IN ('online', 'offline', 'warning', 'error')),
    ip_address TEXT NOT NULL DEFAULT '',
    interconnected BOOLEAN NOT NULL DEFAULT TRUE,
    rdp_url TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    rdp_gateway_url TEXT NOT NULL DEFAULT 'https://guacamole.local/guacamole',
    polling_interval_sec INT NOT NULL DEFAULT 30,
    offline_threshold_min INT NOT NULL DEFAULT 15,
    error_threshold_per_hour INT NOT NULL DEFAULT 5,
    theme_mode TEXT NOT NULL DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark'))
);

INSERT INTO dashboard_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS dashboard_notes (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES dashboard_macchinari(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('ordinaria', 'straordinaria')),
    author TEXT NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dashboard_alerts (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES dashboard_macchinari(id) ON DELETE CASCADE,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    message TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT
);

CREATE TABLE IF NOT EXISTS dashboard_maintenance (
    id TEXT PRIMARY KEY,
    machine_id TEXT NOT NULL REFERENCES dashboard_macchinari(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ordinaria', 'straordinaria')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pianificata'
        CHECK (status IN ('pianificata', 'in_corso', 'completata', 'scaduta')),
    assignee TEXT NOT NULL,
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dashboard_audit (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operator TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS dashboard_report_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    filter_snapshot JSONB NOT NULL DEFAULT '{}',
    pivot_config JSONB NOT NULL DEFAULT '{}',
    default_format TEXT NOT NULL DEFAULT 'csv'
        CHECK (default_format IN ('csv', 'excel', 'json', 'pdf')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dashboard_report_schedules (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES dashboard_report_templates(id) ON DELETE CASCADE,
    cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
    recipients TEXT NOT NULL,
    next_run TIMESTAMPTZ NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_dashboard_notes_machine ON dashboard_notes (machine_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_alerts_status ON dashboard_alerts (status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_dashboard_maintenance_machine ON dashboard_maintenance (machine_id, due_at);

-- Allinea la sequence di conteggi_pezzi dopo import manuale (opzionale)
-- SELECT setval(pg_get_serial_sequence('conteggi_pezzi', 'id'), COALESCE(MAX(id), 1)) FROM conteggi_pezzi;
