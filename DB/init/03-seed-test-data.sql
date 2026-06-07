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
