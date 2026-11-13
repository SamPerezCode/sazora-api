-- Migración 072:
-- Agrega la ubicación operativa a las solicitudes del menú público.
-- La columna permanece temporalmente nullable para permitir un despliegue
-- compatible con la versión anterior de la API.

USE sazora_db;

DROP PROCEDURE IF EXISTS migrate_072_add_public_order_location;

DELIMITER $$

CREATE PROCEDURE migrate_072_add_public_order_location()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'public_order_requests'
            AND column_name = 'location_id'
    ) THEN
        ALTER TABLE public_order_requests
            ADD COLUMN location_id BIGINT UNSIGNED NULL
                AFTER business_id;
    END IF;

    -- Asignar a solicitudes históricas el primer punto de venta activo.

        UPDATE public_order_requests AS por
    INNER JOIN (
        SELECT
            business_id,
            MIN(id) AS location_id
        FROM business_locations
        WHERE
            location_type = 'POINT_OF_SALE'
            AND is_sales_location = TRUE
            AND is_active = TRUE
        GROUP BY business_id
    ) AS default_location
        ON default_location.business_id = por.business_id
    SET por.location_id = default_location.location_id
    WHERE
        por.id > 0
        AND por.location_id IS NULL;
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            constraint_schema = DATABASE()
            AND table_name = 'public_order_requests'
            AND constraint_name = 'fk_public_order_requests_location'
    ) THEN
        ALTER TABLE public_order_requests
            ADD CONSTRAINT fk_public_order_requests_location
                FOREIGN KEY (
                    business_id,
                    location_id
                )
                REFERENCES business_locations (
                    business_id,
                    id
                )
                ON UPDATE RESTRICT
                ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE
            table_schema = DATABASE()
            AND table_name = 'public_order_requests'
            AND index_name =
                'idx_public_order_requests_location_status_created'
    ) THEN
        ALTER TABLE public_order_requests
            ADD INDEX idx_public_order_requests_location_status_created (
                business_id,
                location_id,
                status,
                created_at
            );
    END IF;

    INSERT IGNORE INTO schema_migrations (
        migration_number,
        filename,
        checksum_sha256,
        execution_source,
        notes
    )
    VALUES (
        72,
        '072_add_location_to_public_order_requests.sql',
        NULL,
        'MANUAL',
        'Agrega location_id a las solicitudes públicas y conserva los registros existentes.'
    );
END$$

DELIMITER ;

CALL migrate_072_add_public_order_location();

DROP PROCEDURE IF EXISTS migrate_072_add_public_order_location;

SELECT
    por.id,
    por.public_code,
    por.status,
    por.location_id,
    bl.name AS location_name
FROM public_order_requests AS por
LEFT JOIN business_locations AS bl
    ON bl.business_id = por.business_id
    AND bl.id = por.location_id
ORDER BY por.id;

SELECT
    COUNT(*) AS requests_without_location
FROM public_order_requests
WHERE location_id IS NULL;

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 72;
