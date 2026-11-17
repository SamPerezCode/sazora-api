-- Migración 076:
-- Agrega el canal de origen y los datos históricos del cliente
-- directamente en las órdenes.
--
-- No utiliza commercial_customers porque esa tabla corresponde
-- a clientes fiscales y exige documento de identificación.

USE sazora_db;

DROP PROCEDURE IF EXISTS migrate_076_order_customer_context;

DELIMITER $$

CREATE PROCEDURE migrate_076_order_customer_context()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND column_name = 'source_channel'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN source_channel VARCHAR(20)
                NOT NULL DEFAULT 'IN_PERSON'
                AFTER service_type;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND column_name = 'customer_name'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN customer_name VARCHAR(150) NULL
                AFTER customer_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN customer_phone VARCHAR(30) NULL
                AFTER customer_name;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND column_name = 'customer_email'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN customer_email VARCHAR(254) NULL
                AFTER customer_phone;
    END IF;

    -- Recuperar los datos de solicitudes públicas ya aceptadas.

    UPDATE orders AS o
    INNER JOIN public_order_requests AS por
        ON por.business_id = o.business_id
        AND por.order_id = o.id
    SET
        o.source_channel = 'PUBLIC_MENU',
        o.customer_name = COALESCE(
            o.customer_name,
            por.customer_name
        ),
        o.customer_phone = COALESCE(
            o.customer_phone,
            por.customer_phone
        ),
        o.customer_email = COALESCE(
            o.customer_email,
            por.customer_email
        )
    WHERE
        o.id > 0
        AND por.order_id IS NOT NULL;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND constraint_name = 'chk_orders_source_channel'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT chk_orders_source_channel
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
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND constraint_name = 'chk_orders_customer_name'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT chk_orders_customer_name
                CHECK (
                    customer_name IS NULL
                    OR CHAR_LENGTH(TRIM(customer_name)) > 0
                );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND constraint_name = 'chk_orders_customer_phone'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT chk_orders_customer_phone
                CHECK (
                    customer_phone IS NULL
                    OR CHAR_LENGTH(TRIM(customer_phone)) > 0
                );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND constraint_name = 'chk_orders_customer_email'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT chk_orders_customer_email
                CHECK (
                    customer_email IS NULL
                    OR CHAR_LENGTH(TRIM(customer_email)) > 0
                );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND index_name = 'idx_orders_business_source_created'
    ) THEN
        ALTER TABLE orders
            ADD INDEX idx_orders_business_source_created (
                business_id,
                source_channel,
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
        76,
        '076_add_order_customer_context.sql',
        NULL,
        'MANUAL',
        'Agrega canal de origen y datos históricos del cliente a las órdenes.'
    );
END$$

DELIMITER ;

CALL migrate_076_order_customer_context();

DROP PROCEDURE IF EXISTS migrate_076_order_customer_context;

SELECT
    column_name,
    column_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE
    table_schema = DATABASE()
    AND table_name = 'orders'
    AND column_name IN (
        'source_channel',
        'customer_name',
        'customer_phone',
        'customer_email'
    )
ORDER BY ordinal_position;

SELECT
    source_channel,
    COUNT(*) AS total_orders
FROM orders
GROUP BY source_channel
ORDER BY source_channel;

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 76;
