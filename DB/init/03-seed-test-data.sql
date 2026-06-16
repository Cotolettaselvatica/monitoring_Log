-- Dati di test per sviluppo locale
INSERT INTO dashboard_macchinari (
    id, nome_macchinario, name, code, type, location, department, line, ip_address
) VALUES
    ('m-linea1-macchinaa', 'Linea1_MacchinaA', 'Pressa idraulica 1', 'CTS-001', 'Pressa idraulica',
     'Reparto A - Linea 1', 'Reparto A', 'Linea 1', '10.20.1.10'),
    ('m-linea1-macchinab', 'Linea1_MacchinaB', 'Tornio CNC 2', 'CTS-002', 'Tornio CNC',
     'Reparto A - Linea 1', 'Reparto A', 'Linea 1', '10.20.1.11'),
    ('m-linea2-macchinaa', 'Linea2_MacchinaA', 'Centro di lavoro 3', 'CTS-003', 'Centro di lavoro',
     'Reparto B - Linea 1', 'Reparto B', 'Linea 1', '10.20.2.10'),
    ('m-win-saldatrice', 'Win_Saldatrice01', 'Robot saldatura Win', 'CTS-004', 'Robot di saldatura',
     'Reparto C - Collaudo', 'Reparto C', NULL, '10.20.3.20')
ON CONFLICT (nome_macchinario) DO NOTHING;

-- Conteggi pezzi simulati (ultimi 7 giorni)
INSERT INTO conteggi_pezzi (nome_macchinario, nome_pezzo, timestamp)
SELECT
    mac.nome,
    mac.pezzo,
    NOW() - (gs * interval '17 minutes') - (mac.idx * interval '2 hours')
FROM (
    VALUES
        ('Linea1_MacchinaA', 'ComponenteXYZ', 1),
        ('Linea1_MacchinaA', 'ComponenteXYZ', 2),
        ('Linea1_MacchinaB', 'ComponenteXYZ', 3),
        ('Linea2_MacchinaA', 'ComponenteABC', 4),
        ('Win_Saldatrice01', 'GiuntoLamiera', 5)
) AS mac(nome, pezzo, idx)
CROSS JOIN generate_series(0, 40) AS gs;

-- Macchina B: ultimo conteggio 2 ore fa (warning/offline a seconda della soglia)
INSERT INTO conteggi_pezzi (nome_macchinario, nome_pezzo, timestamp)
VALUES ('Linea1_MacchinaB', 'ComponenteXYZ', NOW() - interval '2 hours');

-- Macchina Win: attività recente (online)
INSERT INTO conteggi_pezzi (nome_macchinario, nome_pezzo, timestamp)
SELECT 'Win_Saldatrice01', 'GiuntoLamiera', NOW() - (n * interval '3 minutes')
FROM generate_series(0, 8) AS n;

INSERT INTO dashboard_notes (id, machine_id, type, author, text)
VALUES
    ('n-test-1', 'm-linea1-macchinaa', 'ordinaria', 'operatore.rossi',
     'Controllo olio eseguito, nessuna anomalia.'),
    ('n-test-2', 'm-linea2-macchinaa', 'straordinaria', 'manutenzione.verdi',
     'Sostituito sensore fine corsa.')
ON CONFLICT (id) DO NOTHING;

-- Ping reachability simulati (ultimi ~20 min, ogni 10 s)
INSERT INTO ping_checks (nome_macchinario, ip, reachable, timestamp)
SELECT
    mac.nome,
    mac.ip,
    CASE
        WHEN mac.nome = 'Linea1_MacchinaB' AND gs >= 90 THEN false
        WHEN mac.nome = 'Linea2_MacchinaA' AND gs % 20 = 0 THEN false
        WHEN mac.nome = 'DVK_121120-886' AND gs >= 60 THEN false
        ELSE true
    END,
    NOW() - (gs * interval '10 seconds')
FROM (
    VALUES
        ('Linea1_MacchinaA', '10.20.1.10'),
        ('Linea1_MacchinaB', '10.20.1.11'),
        ('Linea2_MacchinaA', '10.20.2.10'),
        ('Win_Saldatrice01', '10.20.3.20'),
        ('LMS_asservimento_DVK_3LMS-R25-PA-AU', '10.0.0.241'),
        ('DVK_3W-MOA6-8C', '10.0.0.238'),
        ('DVK_asservimento_LR_MATE_200iD', '10.0.0.224'),
        ('DVK_121120-886', '10.0.0.222')
) AS mac(nome, ip)
CROSS JOIN generate_series(0, 120) AS gs;
