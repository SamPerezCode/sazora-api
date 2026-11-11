-- Migración 069:
-- Asocia cada reversión de pago por anulación con el turno de caja
-- donde fue procesada.

USE sazora_db;

ALTER TABLE sale_void_payments
    ADD COLUMN cash_session_id BIGINT UNSIGNED NULL
    AFTER sale_id;

-- Compatibilidad con anulaciones anteriores:
-- 1. Usa el turno del movimiento de efectivo cuando existe.
-- 2. Para pagos no efectivos antiguos, usa el turno de la venta original.

UPDATE sale_void_payments AS svp
INNER JOIN sales AS s
    ON s.business_id = svp.business_id
    AND s.id = svp.sale_id
LEFT JOIN cash_movements AS cm
    ON cm.business_id = svp.business_id
    AND cm.id = svp.cash_movement_id
SET svp.cash_session_id = COALESCE(
    cm.cash_session_id,
    s.cash_session_id
)
WHERE
    svp.id > 0
    AND svp.cash_session_id IS NULL;

ALTER TABLE sale_void_payments
    MODIFY COLUMN cash_session_id BIGINT UNSIGNED NOT NULL;

ALTER TABLE sale_void_payments
    ADD CONSTRAINT fk_sale_void_payments_cash_session
        FOREIGN KEY (
            business_id,
            cash_session_id
        )
        REFERENCES cash_sessions (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    ADD INDEX idx_sale_void_payments_session (
        business_id,
        cash_session_id,
        created_at,
        id
    );

INSERT IGNORE INTO schema_migrations (
    migration_number,
    filename,
    checksum_sha256,
    execution_source,
    notes
)
VALUES (
    69,
    '069_add_sale_void_cash_session.sql',
    NULL,
    'MANUAL',
    'Asocia las anulaciones de pagos con el turno donde fueron procesadas.'
);

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 69;

SHOW CREATE TABLE sale_void_payments;
