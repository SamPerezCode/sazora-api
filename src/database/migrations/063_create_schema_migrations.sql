-- Migración 063:
-- Crea el historial formal de migraciones.
-- La versión 062 se registra como línea base porque las migraciones
-- anteriores fueron verificadas manualmente en producción.

USE sazora_db;

CREATE TABLE schema_migrations (
    migration_number SMALLINT UNSIGNED NOT NULL,
    filename VARCHAR(255) NOT NULL,

    checksum_sha256 CHAR(64) NULL,

    execution_source VARCHAR(20) NOT NULL,
    notes VARCHAR(500) NULL,

    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_schema_migrations
        PRIMARY KEY (migration_number),

    CONSTRAINT uq_schema_migrations_filename
        UNIQUE (filename),

    CONSTRAINT chk_schema_migrations_number
        CHECK (migration_number > 0),

    CONSTRAINT chk_schema_migrations_checksum
        CHECK (
            checksum_sha256 IS NULL
            OR checksum_sha256 REGEXP '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_schema_migrations_source
        CHECK (
            execution_source IN (
                'BASELINE',
                'MANUAL',
                'AUTOMATED'
            )
        ),

    CONSTRAINT chk_schema_migrations_notes
        CHECK (
            notes IS NULL
            OR CHAR_LENGTH(TRIM(notes)) > 0
        ),

    INDEX idx_schema_migrations_applied_at (
        applied_at
    )
) ENGINE = InnoDB;

-- Las migraciones 001 a 062 fueron verificadas mediante auditoría
-- de tablas, columnas y restricciones en producción.

INSERT INTO schema_migrations (
    migration_number,
    filename,
    checksum_sha256,
    execution_source,
    notes
)
VALUES
(
    62,
    '062_create_inventory_reservations.sql',
    NULL,
    'BASELINE',
    'Línea base: migraciones 001 a 062 verificadas manualmente.'
),
(
    63,
    '063_create_schema_migrations.sql',
    NULL,
    'MANUAL',
    'Creación del historial formal de migraciones.'
);

SELECT
    migration_number,
    filename,
    execution_source,
    notes,
    applied_at
FROM schema_migrations
ORDER BY migration_number;
