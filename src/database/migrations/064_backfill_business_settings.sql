-- Migración 064:
-- Crea la configuración faltante para negocios existentes.
-- No modifica configuraciones existentes.
-- No asigna moneda, zona horaria ni información fiscal.

USE sazora_db;

INSERT IGNORE INTO business_settings (
    business_id
)
SELECT
    b.id
FROM businesses AS b;

INSERT IGNORE INTO schema_migrations (
    migration_number,
    filename,
    checksum_sha256,
    execution_source,
    notes
)
VALUES (
    64,
    '064_backfill_business_settings.sql',
    NULL,
    'MANUAL',
    'Crea configuraciones faltantes para negocios existentes sin sobrescribir datos.'
);

SELECT
    b.id AS business_id,
    b.slug,
    CASE
        WHEN bs.business_id IS NULL THEN 'FALTA_CONFIGURACION'
        ELSE 'CONFIGURACION_EXISTENTE'
    END AS settings_status
FROM businesses AS b
LEFT JOIN business_settings AS bs
    ON bs.business_id = b.id
ORDER BY b.id;

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 64;
