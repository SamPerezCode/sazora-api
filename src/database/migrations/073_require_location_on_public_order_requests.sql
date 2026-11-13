-- Migración 073:
-- Hace obligatoria la ubicación en todas las solicitudes públicas.
-- Ejecutar solamente después de desplegar la API que recibe locationId.

USE sazora_db;

DROP PROCEDURE IF EXISTS migrate_073_require_public_order_location;

DELIMITER $$

CREATE PROCEDURE migrate_073_require_public_order_location()
BEGIN
    DECLARE requests_without_location BIGINT DEFAULT 0;

    -- Cubrir solicitudes creadas entre la migración 072 y el despliegue.

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

    SELECT COUNT(*)
    INTO requests_without_location
    FROM public_order_requests
    WHERE location_id IS NULL;

    IF requests_without_location > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Existen solicitudes públicas sin un punto de venta válido';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'public_order_requests'
            AND column_name = 'location_id'
            AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE public_order_requests
            MODIFY COLUMN location_id BIGINT UNSIGNED NOT NULL
                AFTER business_id;
    END IF;

    INSERT IGNORE INTO schema_migrations (
        migration_number,
        filename,
        checksum_sha256,
        execution_source,
        notes
    )
    VALUES (
        73,
        '073_require_location_on_public_order_requests.sql',
        NULL,
        'MANUAL',
        'Hace obligatoria la ubicación en todas las solicitudes públicas.'
    );
END$$

DELIMITER ;

CALL migrate_073_require_public_order_location();

DROP PROCEDURE IF EXISTS migrate_073_require_public_order_location;

SELECT
    column_name,
    column_type,
    is_nullable
FROM information_schema.columns
WHERE
    table_schema = DATABASE()
    AND table_name = 'public_order_requests'
    AND column_name = 'location_id';

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
WHERE migration_number = 73;
