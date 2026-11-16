-- Migración 075:
-- Crea devoluciones completas de pagos anticipados de órdenes.
-- La devolución debe realizarse antes de cancelar una orden pagada.

USE sazora_db;

-- Encabezado de la devolución del lote de pago.

CREATE TABLE IF NOT EXISTS order_payment_refunds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    payment_batch_id BIGINT UNSIGNED NOT NULL,
    cash_session_id BIGINT UNSIGNED NULL,
    processed_by_membership_id BIGINT UNSIGNED NOT NULL,

    total_amount DECIMAL(18, 2) NOT NULL,
    reason VARCHAR(500) NOT NULL,

    refunded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_payment_refunds
        PRIMARY KEY (id),

    CONSTRAINT uq_order_payment_refunds_business_refund
        UNIQUE (
            business_id,
            id
        ),

    -- Un lote anticipado solamente puede devolverse una vez.
    CONSTRAINT uq_order_payment_refunds_batch
        UNIQUE (
            business_id,
            payment_batch_id
        ),

    CONSTRAINT fk_order_payment_refunds_batch
        FOREIGN KEY (
            business_id,
            payment_batch_id
        )
        REFERENCES order_payment_batches (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_payment_refunds_cash_session
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

    CONSTRAINT fk_order_payment_refunds_processed_by
        FOREIGN KEY (
            business_id,
            processed_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_payment_refunds_total
        CHECK (
            total_amount > 0
        ),

    CONSTRAINT chk_order_payment_refunds_reason
        CHECK (
            CHAR_LENGTH(TRIM(reason)) >= 5
        ),

    INDEX idx_order_payment_refunds_batch (
        business_id,
        payment_batch_id,
        refunded_at,
        id
    ),

    INDEX idx_order_payment_refunds_session (
        business_id,
        cash_session_id,
        refunded_at,
        id
    ),

    INDEX idx_order_payment_refunds_processed_by (
        business_id,
        processed_by_membership_id,
        refunded_at,
        id
    )
) ENGINE = InnoDB;

-- Detalle de los pagos devueltos.

CREATE TABLE IF NOT EXISTS order_payment_refund_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    refund_id BIGINT UNSIGNED NOT NULL,
    order_payment_id BIGINT UNSIGNED NOT NULL,
    cash_movement_id BIGINT UNSIGNED NULL,

    payment_method_code VARCHAR(50) NOT NULL,
    payment_method_name VARCHAR(120) NOT NULL,
    payment_type VARCHAR(30) NOT NULL,

    requires_reference BOOLEAN NOT NULL,
    affects_cash BOOLEAN NOT NULL,

    amount DECIMAL(18, 2) NOT NULL,

    reference VARCHAR(120) NULL,
    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_payment_refund_lines
        PRIMARY KEY (id),

    CONSTRAINT uq_order_payment_refund_lines_business_line
        UNIQUE (
            business_id,
            id
        ),

    -- Impide devolver dos veces el mismo pago original.
    CONSTRAINT uq_order_payment_refund_lines_original
        UNIQUE (
            business_id,
            order_payment_id
        ),

    CONSTRAINT uq_order_payment_refund_lines_cash_movement
        UNIQUE (
            business_id,
            cash_movement_id
        ),

    CONSTRAINT fk_order_payment_refund_lines_refund
        FOREIGN KEY (
            business_id,
            refund_id
        )
        REFERENCES order_payment_refunds (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_payment_refund_lines_original
        FOREIGN KEY (
            business_id,
            order_payment_id
        )
        REFERENCES order_payments (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_payment_refund_lines_cash_movement
        FOREIGN KEY (
            business_id,
            cash_movement_id
        )
        REFERENCES cash_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_payment_refund_lines_type
        CHECK (
            payment_type IN (
                'CASH',
                'CARD',
                'BANK_TRANSFER',
                'DIGITAL_WALLET',
                'VOUCHER',
                'STORE_CREDIT',
                'OTHER'
            )
        ),

    CONSTRAINT chk_order_payment_refund_lines_amount
        CHECK (
            amount > 0
        ),

    CONSTRAINT chk_order_payment_refund_lines_cash_flags
        CHECK (
            (
                payment_type = 'CASH'
                AND affects_cash = TRUE
            )
            OR
            (
                payment_type <> 'CASH'
                AND affects_cash = FALSE
            )
        ),

    CONSTRAINT chk_order_payment_refund_lines_reference
        CHECK (
            requires_reference = FALSE
            OR (
                reference IS NOT NULL
                AND CHAR_LENGTH(TRIM(reference)) > 0
            )
        ),

    CONSTRAINT chk_order_payment_refund_lines_notes
        CHECK (
            notes IS NULL
            OR CHAR_LENGTH(TRIM(notes)) > 0
        ),

    INDEX idx_order_payment_refund_lines_refund (
        business_id,
        refund_id,
        id
    ),

    INDEX idx_order_payment_refund_lines_original (
        business_id,
        order_payment_id,
        refund_id
    )
) ENGINE = InnoDB;

-- Permitir movimientos de caja originados por devoluciones
-- de pagos anticipados.

DROP PROCEDURE IF EXISTS migrate_075_cash_movement_source;

DELIMITER $$

CREATE PROCEDURE migrate_075_cash_movement_source()
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'cash_movements'
            AND constraint_name = 'chk_cash_movements_source'
    ) THEN
        ALTER TABLE cash_movements
            DROP CHECK chk_cash_movements_source;
    END IF;

    ALTER TABLE cash_movements
        ADD CONSTRAINT chk_cash_movements_source
            CHECK (
                (
                    source_type IS NULL
                    AND source_id IS NULL
                    AND movement_type IN (
                        'MANUAL_INCOME',
                        'WITHDRAWAL',
                        'EXPENSE',
                        'ADJUSTMENT_IN',
                        'ADJUSTMENT_OUT'
                    )
                )
                OR
                (
                    source_type = 'SALE_PAYMENT'
                    AND source_id IS NOT NULL
                    AND movement_type = 'CASH_SALE'
                )
                OR
                (
                    source_type = 'ORDER_PAYMENT'
                    AND source_id IS NOT NULL
                    AND movement_type = 'CASH_SALE'
                )
                OR
                (
                    source_type = 'REFUND_PAYMENT'
                    AND source_id IS NOT NULL
                    AND movement_type = 'CASH_REFUND'
                )
                OR
                (
                    source_type = 'ORDER_PAYMENT_REFUND'
                    AND source_id IS NOT NULL
                    AND movement_type = 'CASH_REFUND'
                )
            );
END$$

DELIMITER ;

CALL migrate_075_cash_movement_source();

DROP PROCEDURE IF EXISTS migrate_075_cash_movement_source;

-- Permiso específico para devolver pagos anticipados.

INSERT INTO permissions (
    code,
    module,
    name,
    description,
    is_active
)
VALUES (
    'orders.payments.refund',
    'orders',
    'Devolver pagos anticipados',
    'Permite devolver el pago anticipado de una orden antes de cancelarla.',
    TRUE
)
ON DUPLICATE KEY UPDATE
    module = 'orders',
    name = 'Devolver pagos anticipados',
    description =
        'Permite devolver el pago anticipado de una orden antes de cancelarla.',
    is_active = TRUE;

-- Administrador, caja y gestión de solicitudes públicas.

INSERT INTO role_permissions (
    role_id,
    permission_id,
    is_active
)
SELECT
    r.id,
    p.id,
    TRUE
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code = 'orders.payments.refund'
WHERE
    r.code IN (
        'ADMIN',
        'CASHIER',
        'PUBLIC_ORDER_MANAGER'
    )
    AND r.is_active = TRUE
    AND p.is_active = TRUE
ON DUPLICATE KEY UPDATE
    is_active = TRUE;

-- ADMIN conserva todos los permisos activos.

INSERT INTO role_permissions (
    role_id,
    permission_id,
    is_active
)
SELECT
    r.id,
    p.id,
    TRUE
FROM roles AS r
CROSS JOIN permissions AS p
WHERE
    r.code = 'ADMIN'
    AND r.is_active = TRUE
    AND p.is_active = TRUE
ON DUPLICATE KEY UPDATE
    is_active = TRUE;

-- Registrar la migración.

INSERT IGNORE INTO schema_migrations (
    migration_number,
    filename,
    checksum_sha256,
    execution_source,
    notes
)
VALUES (
    75,
    '075_create_order_payment_refunds.sql',
    NULL,
    'MANUAL',
    'Crea devoluciones completas de pagos anticipados de órdenes.'
);

-- Verificaciones.

SELECT
    table_name
FROM information_schema.tables
WHERE
    table_schema = DATABASE()
    AND table_name IN (
        'order_payment_refunds',
        'order_payment_refund_lines'
    )
ORDER BY table_name;

SELECT
    r.code AS role_code,
    p.code AS permission_code,
    rp.is_active
FROM role_permissions AS rp
INNER JOIN roles AS r
    ON r.id = rp.role_id
INNER JOIN permissions AS p
    ON p.id = rp.permission_id
WHERE
    r.code IN (
        'ADMIN',
        'CASHIER',
        'PUBLIC_ORDER_MANAGER'
    )
    AND p.code = 'orders.payments.refund'
ORDER BY r.code;

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 75;

SHOW CREATE TABLE order_payment_refunds;
SHOW CREATE TABLE order_payment_refund_lines;
SHOW CREATE TABLE cash_movements;
