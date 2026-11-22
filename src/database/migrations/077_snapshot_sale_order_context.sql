-- Migración 077:
-- Conserva en cada venta una copia histórica del tipo de servicio
-- y del canal de origen de la orden.
--
-- No crea order_mode porque service_type ya representa la modalidad:
-- TABLE, TAKEAWAY o DELIVERY.

USE sazora_db;

DROP PROCEDURE IF EXISTS migrate_077_sale_order_context;

DELIMITER $$

CREATE PROCEDURE migrate_077_sale_order_context()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'sales'
            AND column_name = 'service_type'
    ) THEN
        ALTER TABLE sales
            ADD COLUMN service_type VARCHAR(20) NULL
                AFTER order_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'sales'
            AND column_name = 'source_channel'
    ) THEN
        ALTER TABLE sales
            ADD COLUMN source_channel VARCHAR(20) NULL
                AFTER service_type;
    END IF;

    -- Recuperar el contexto de las ventas históricas desde su orden.

    UPDATE sales AS s
    INNER JOIN orders AS o
        ON o.business_id = s.business_id
        AND o.id = s.order_id
    SET
        s.service_type = COALESCE(
            s.service_type,
            o.service_type
        ),
        s.source_channel = COALESCE(
            s.source_channel,
            o.source_channel
        )
    WHERE
        s.id > 0
        AND (
            s.service_type IS NULL
            OR s.source_channel IS NULL
        );

    -- Una venta siempre tiene una orden vinculada, por lo que después
    -- de recuperar los datos no deben quedar instantáneas incompletas.

    IF EXISTS (
        SELECT 1
        FROM sales
        WHERE
            service_type IS NULL
            OR source_channel IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'No fue posible recuperar el origen o servicio de todas las ventas';
    END IF;

    ALTER TABLE sales
        MODIFY COLUMN service_type VARCHAR(20) NOT NULL
            AFTER order_id,
        MODIFY COLUMN source_channel VARCHAR(20) NOT NULL
            AFTER service_type;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'sales'
            AND constraint_name = 'chk_sales_service_type'
    ) THEN
        ALTER TABLE sales
            ADD CONSTRAINT chk_sales_service_type
                CHECK (
                    service_type IN (
                        'TABLE',
                        'TAKEAWAY',
                        'DELIVERY'
                    )
                );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'sales'
            AND constraint_name = 'chk_sales_source_channel'
    ) THEN
        ALTER TABLE sales
            ADD CONSTRAINT chk_sales_source_channel
                CHECK (
                    source_channel IN (
                        'IN_PERSON',
                        'WHATSAPP',
                        'PHONE',
                        'PUBLIC_MENU'
                    )
                );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE
            table_schema = DATABASE()
            AND table_name = 'sales'
            AND index_name = 'idx_sales_business_service_sold'
    ) THEN
        ALTER TABLE sales
            ADD INDEX idx_sales_business_service_sold (
                business_id,
                service_type,
                sold_at
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE
            table_schema = DATABASE()
            AND table_name = 'sales'
            AND index_name = 'idx_sales_business_source_sold'
    ) THEN
        ALTER TABLE sales
            ADD INDEX idx_sales_business_source_sold (
                business_id,
                source_channel,
                sold_at
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
        77,
        '077_snapshot_sale_order_context.sql',
        NULL,
        'MANUAL',
        'Conserva tipo de servicio y canal de origen como instantáneas históricas de cada venta.'
    );
END$$

DELIMITER ;

CALL migrate_077_sale_order_context();

DROP PROCEDURE IF EXISTS migrate_077_sale_order_context;

-- Verificaciones.

SELECT
    column_name,
    column_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE
    table_schema = DATABASE()
    AND table_name = 'sales'
    AND column_name IN (
        'service_type',
        'source_channel'
    )
ORDER BY ordinal_position;

SELECT
    service_type,
    source_channel,
    COUNT(*) AS total_sales
FROM sales
GROUP BY
    service_type,
    source_channel
ORDER BY
    service_type,
    source_channel;

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 77;

SHOW CREATE TABLE sales;
