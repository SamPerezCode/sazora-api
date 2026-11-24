-- Migración 078:
-- Prepara la identificación comercial del cliente por teléfono normalizado
-- y relaciona solicitudes y órdenes con commercial_customers.
--
-- No modifica silenciosamente los teléfonos históricos.
-- Los registros anteriores conservarán normalized_phone en NULL hasta que
-- sean revisados o actualizados mediante el servicio de clientes.

USE sazora_db;

DROP PROCEDURE IF EXISTS migrate_078_customer_identity_and_links;

DELIMITER $$

CREATE PROCEDURE migrate_078_customer_identity_and_links()
BEGIN
    /*
     * commercial_customers actualmente exige documento.
     * Un cliente operativo puede existir sin información fiscal, por lo que
     * documento y tipo de documento pasan a ser opcionales.
     */

    ALTER TABLE commercial_customers
        MODIFY COLUMN document_type VARCHAR(20) NULL,
        MODIFY COLUMN document_number VARCHAR(30) NULL;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND constraint_name = 'chk_commercial_customers_document_pair'
    ) THEN
        ALTER TABLE commercial_customers
            ADD CONSTRAINT chk_commercial_customers_document_pair
                CHECK (
                    (
                        document_type IS NULL
                        AND document_number IS NULL
                    )
                    OR
                    (
                        document_type IS NOT NULL
                        AND document_number IS NOT NULL
                        AND CHAR_LENGTH(TRIM(document_number)) > 0
                    )
                );
    END IF;

    /*
     * Teléfono canónico utilizado para identificar al mismo cliente dentro
     * del negocio. Ejemplo: +573006018789.
     */

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND column_name = 'normalized_phone'
    ) THEN
        ALTER TABLE commercial_customers
            ADD COLUMN normalized_phone VARCHAR(16) NULL
                AFTER billing_phone;
    END IF;

    /*
     * Conservamos tanto el primer canal conocido como el último canal usado.
     * Esto evita sobrescribir la atribución original del cliente.
     */

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND column_name = 'acquisition_source_channel'
    ) THEN
        ALTER TABLE commercial_customers
            ADD COLUMN acquisition_source_channel VARCHAR(20) NULL
                AFTER normalized_phone;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND column_name = 'last_source_channel'
    ) THEN
        ALTER TABLE commercial_customers
            ADD COLUMN last_source_channel VARCHAR(20) NULL
                AFTER acquisition_source_channel;
    END IF;

    /*
     * El consentimiento comercial es independiente del teléfono utilizado
     * para prestar el servicio.
     */

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND column_name = 'marketing_consent'
    ) THEN
        ALTER TABLE commercial_customers
            ADD COLUMN marketing_consent BOOLEAN NOT NULL DEFAULT FALSE
                AFTER last_source_channel;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND column_name = 'marketing_consent_at'
    ) THEN
        ALTER TABLE commercial_customers
            ADD COLUMN marketing_consent_at DATETIME(3) NULL
                AFTER marketing_consent;
    END IF;

    /*
     * Fechas comerciales. No dependen de cualquier modificación fiscal:
     * serán actualizadas explícitamente por el servicio de clientes.
     */

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND column_name = 'first_seen_at'
    ) THEN
        ALTER TABLE commercial_customers
            ADD COLUMN first_seen_at DATETIME(3) NULL
                AFTER marketing_consent_at;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND column_name = 'last_seen_at'
    ) THEN
        ALTER TABLE commercial_customers
            ADD COLUMN last_seen_at DATETIME(3) NULL
                AFTER first_seen_at;
    END IF;

    UPDATE commercial_customers
    SET
        first_seen_at = COALESCE(first_seen_at, created_at),
        last_seen_at = COALESCE(last_seen_at, updated_at)
    WHERE
        id > 0
        AND (
            first_seen_at IS NULL
            OR last_seen_at IS NULL
        );

    ALTER TABLE commercial_customers
        MODIFY COLUMN first_seen_at DATETIME(3) NOT NULL,
        MODIFY COLUMN last_seen_at DATETIME(3) NOT NULL;

    /*
     * No puede existir más de un cliente con el mismo teléfono normalizado
     * dentro de un negocio. MySQL permite múltiples valores NULL, por lo que
     * los clientes históricos todavía no normalizados siguen siendo válidos.
     */

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND index_name = 'uq_commercial_customers_normalized_phone'
    ) THEN
        ALTER TABLE commercial_customers
            ADD CONSTRAINT uq_commercial_customers_normalized_phone
                UNIQUE (
                    business_id,
                    normalized_phone
                );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'commercial_customers'
            AND constraint_name = 'chk_commercial_customers_acquisition_source'
    ) THEN
        ALTER TABLE commercial_customers
            ADD CONSTRAINT chk_commercial_customers_acquisition_source
                CHECK (
                    acquisition_source_channel IS NULL
                    OR acquisition_source_channel IN (
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
            AND table_name = 'commercial_customers'
            AND constraint_name = 'chk_commercial_customers_last_source'
    ) THEN
        ALTER TABLE commercial_customers
            ADD CONSTRAINT chk_commercial_customers_last_source
                CHECK (
                    last_source_channel IS NULL
                    OR last_source_channel IN (
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
            AND table_name = 'commercial_customers'
            AND constraint_name = 'chk_commercial_customers_consent_date'
    ) THEN
        ALTER TABLE commercial_customers
            ADD CONSTRAINT chk_commercial_customers_consent_date
                CHECK (
                    (
                        marketing_consent = FALSE
                        AND marketing_consent_at IS NULL
                    )
                    OR
                    (
                        marketing_consent = TRUE
                        AND marketing_consent_at IS NOT NULL
                    )
                );
    END IF;

    /*
     * Relación de la solicitud pública con el cliente identificado.
     */

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'public_order_requests'
            AND column_name = 'commercial_customer_id'
    ) THEN
        ALTER TABLE public_order_requests
            ADD COLUMN commercial_customer_id BIGINT UNSIGNED NULL
                AFTER location_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE
            table_schema = DATABASE()
            AND table_name = 'public_order_requests'
            AND index_name = 'idx_public_order_requests_customer'
    ) THEN
        ALTER TABLE public_order_requests
            ADD INDEX idx_public_order_requests_customer (
                business_id,
                commercial_customer_id,
                created_at
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'public_order_requests'
            AND constraint_name = 'fk_public_order_requests_customer'
    ) THEN
        ALTER TABLE public_order_requests
            ADD CONSTRAINT fk_public_order_requests_customer
                FOREIGN KEY (
                    business_id,
                    commercial_customer_id
                )
                REFERENCES commercial_customers (
                    business_id,
                    id
                )
                ON UPDATE RESTRICT
                ON DELETE RESTRICT;
    END IF;

    /*
     * Relación de la orden operativa con el cliente identificado.
     */

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND column_name = 'commercial_customer_id'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN commercial_customer_id BIGINT UNSIGNED NULL
                AFTER location_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND index_name = 'idx_orders_customer_created'
    ) THEN
        ALTER TABLE orders
            ADD INDEX idx_orders_customer_created (
                business_id,
                commercial_customer_id,
                created_at
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND constraint_name = 'fk_orders_customer'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT fk_orders_customer
                FOREIGN KEY (
                    business_id,
                    commercial_customer_id
                )
                REFERENCES commercial_customers (
                    business_id,
                    id
                )
                ON UPDATE RESTRICT
                ON DELETE RESTRICT;
    END IF;

    INSERT IGNORE INTO schema_migrations (
        migration_number,
        filename,
        checksum_sha256,
        execution_source,
        notes
    )
    VALUES (
        78,
        '078_add_customer_identity_and_links.sql',
        NULL,
        'MANUAL',
        'Agrega identidad por teléfono, atribución, consentimiento y relaciones de clientes con solicitudes y órdenes.'
    );
END$$

DELIMITER ;

CALL migrate_078_customer_identity_and_links();

DROP PROCEDURE IF EXISTS migrate_078_customer_identity_and_links;

-- Verificaciones.

SELECT
    column_name,
    column_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE
    table_schema = DATABASE()
    AND table_name = 'commercial_customers'
    AND column_name IN (
        'document_type',
        'document_number',
        'normalized_phone',
        'acquisition_source_channel',
        'last_source_channel',
        'marketing_consent',
        'marketing_consent_at',
        'first_seen_at',
        'last_seen_at'
    )
ORDER BY ordinal_position;

SELECT
    table_name,
    column_name,
    column_type,
    is_nullable
FROM information_schema.columns
WHERE
    table_schema = DATABASE()
    AND table_name IN (
        'public_order_requests',
        'orders',
        'sales'
    )
    AND column_name = 'commercial_customer_id'
ORDER BY table_name;

SELECT
    constraint_name,
    table_name,
    constraint_type
FROM information_schema.table_constraints
WHERE
    table_schema = DATABASE()
    AND constraint_name IN (
        'uq_commercial_customers_normalized_phone',
        'fk_public_order_requests_customer',
        'fk_orders_customer'
    )
ORDER BY table_name, constraint_name;

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 78;

SHOW CREATE TABLE commercial_customers;
SHOW CREATE TABLE public_order_requests;
SHOW CREATE TABLE orders;
