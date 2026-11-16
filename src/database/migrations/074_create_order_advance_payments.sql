-- Migración 074:
-- Crea el modelo de pagos anticipados asociados a órdenes.
--
-- Permite verificar y conservar un pago antes de enviar una orden
-- a cocina. Posteriormente, al entregar la orden, estos pagos se
-- transfieren a la venta definitiva sin volver a cobrar ni volver
-- a afectar la caja.

USE sazora_db;

DROP PROCEDURE IF EXISTS migrate_074_order_advance_payments;

DELIMITER $$

CREATE PROCEDURE migrate_074_order_advance_payments()
BEGIN
    -- Estado financiero independiente del estado operativo.

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN payment_status VARCHAR(20)
                NOT NULL DEFAULT 'PENDING'
                AFTER status;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND column_name = 'payment_verified_at'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN payment_verified_at DATETIME(3) NULL
                AFTER payment_status;
    END IF;

    -- Las órdenes que ya tienen una venta son pagos históricos
    -- completamente consumidos por la venta.

    UPDATE orders AS o
    INNER JOIN sales AS s
        ON s.business_id = o.business_id
        AND s.order_id = o.id
    SET
        o.payment_status = 'CONSUMED',
        o.payment_verified_at = COALESCE(
            o.payment_verified_at,
            s.sold_at
        )
    WHERE
        o.id > 0
        AND o.payment_status = 'PENDING';

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND constraint_name = 'chk_orders_payment_status'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT chk_orders_payment_status
                CHECK (
                    payment_status IN (
                        'PENDING',
                        'VERIFIED',
                        'CONSUMED',
                        'REFUNDED',
                        'VOIDED'
                    )
                );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE
            table_schema = DATABASE()
            AND table_name = 'orders'
            AND constraint_name = 'chk_orders_payment_status_data'
    ) THEN
        ALTER TABLE orders
            ADD CONSTRAINT chk_orders_payment_status_data
                CHECK (
                    (
                        payment_status = 'PENDING'
                        AND payment_verified_at IS NULL
                    )
                    OR
                    (
                        payment_status IN (
                            'VERIFIED',
                            'CONSUMED',
                            'REFUNDED',
                            'VOIDED'
                        )
                        AND payment_verified_at IS NOT NULL
                    )
                );
    END IF;
END$$

DELIMITER ;

CALL migrate_074_order_advance_payments();

DROP PROCEDURE IF EXISTS migrate_074_order_advance_payments;

-- Un lote representa una operación completa de pago.
-- Puede contener efectivo, tarjeta y otros medios simultáneamente.

CREATE TABLE IF NOT EXISTS order_payment_batches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    cash_session_id BIGINT UNSIGNED NOT NULL,
    verified_by_membership_id BIGINT UNSIGNED NOT NULL,

    sale_id BIGINT UNSIGNED NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'VERIFIED',

    idempotency_key VARCHAR(100) NOT NULL,

    paid_total DECIMAL(18, 2) NOT NULL,
    change_total DECIMAL(18, 2) NOT NULL DEFAULT 0.00,

    verified_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    consumed_at DATETIME(3) NULL,
    refunded_at DATETIME(3) NULL,
    voided_at DATETIME(3) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_payment_batches
        PRIMARY KEY (id),

    CONSTRAINT uq_order_payment_batches_business_batch
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_order_payment_batches_order
        UNIQUE (
            business_id,
            order_id
        ),

    CONSTRAINT uq_order_payment_batches_idempotency
        UNIQUE (
            business_id,
            idempotency_key
        ),

    CONSTRAINT uq_order_payment_batches_sale
        UNIQUE (
            business_id,
            sale_id
        ),

    CONSTRAINT fk_order_payment_batches_order
        FOREIGN KEY (
            business_id,
            order_id
        )
        REFERENCES orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_payment_batches_cash_session
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

    CONSTRAINT fk_order_payment_batches_verified_by
        FOREIGN KEY (
            business_id,
            verified_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_payment_batches_sale
        FOREIGN KEY (
            business_id,
            sale_id
        )
        REFERENCES sales (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_payment_batches_status
        CHECK (
            status IN (
                'VERIFIED',
                'CONSUMED',
                'REFUNDED',
                'VOIDED'
            )
        ),

    CONSTRAINT chk_order_payment_batches_totals
        CHECK (
            paid_total > 0
            AND change_total >= 0
        ),

    CONSTRAINT chk_order_payment_batches_idempotency
        CHECK (
            CHAR_LENGTH(TRIM(idempotency_key)) >= 16
        ),

    CONSTRAINT chk_order_payment_batches_state_data
        CHECK (
            (
                status = 'VERIFIED'
                AND sale_id IS NULL
                AND consumed_at IS NULL
                AND refunded_at IS NULL
                AND voided_at IS NULL
            )
            OR
            (
                status = 'CONSUMED'
                AND sale_id IS NOT NULL
                AND consumed_at IS NOT NULL
                AND refunded_at IS NULL
                AND voided_at IS NULL
            )
            OR
            (
                status = 'REFUNDED'
                AND sale_id IS NULL
                AND consumed_at IS NULL
                AND refunded_at IS NOT NULL
                AND voided_at IS NULL
            )
            OR
            (
                status = 'VOIDED'
                AND sale_id IS NULL
                AND consumed_at IS NULL
                AND refunded_at IS NULL
                AND voided_at IS NOT NULL
            )
        ),

    INDEX idx_order_payment_batches_session (
        business_id,
        cash_session_id,
        verified_at,
        id
    ),

    INDEX idx_order_payment_batches_status (
        business_id,
        status,
        verified_at,
        id
    ),

    INDEX idx_order_payment_batches_verified_by (
        business_id,
        verified_by_membership_id,
        verified_at,
        id
    )
) ENGINE = InnoDB;

-- Detalle de los medios utilizados en un pago anticipado.

CREATE TABLE IF NOT EXISTS order_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    payment_batch_id BIGINT UNSIGNED NOT NULL,

    payment_method_id BIGINT UNSIGNED NOT NULL,
    processed_by_membership_id BIGINT UNSIGNED NOT NULL,

    cash_movement_id BIGINT UNSIGNED NULL,
    sale_payment_id BIGINT UNSIGNED NULL,

    payment_method_code VARCHAR(50) NOT NULL,
    payment_method_name VARCHAR(120) NOT NULL,
    payment_type VARCHAR(30) NOT NULL,

    requires_reference BOOLEAN NOT NULL,
    affects_cash BOOLEAN NOT NULL,
    allows_change BOOLEAN NOT NULL,

    amount DECIMAL(18, 2) NOT NULL,
    tendered_amount DECIMAL(18, 2) NOT NULL,
    change_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,

    reference VARCHAR(120) NULL,
    notes VARCHAR(500) NULL,

    paid_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_payments
        PRIMARY KEY (id),

    CONSTRAINT uq_order_payments_business_payment
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_order_payments_batch_method
        UNIQUE (
            business_id,
            payment_batch_id,
            payment_method_id
        ),

    CONSTRAINT uq_order_payments_cash_movement
        UNIQUE (
            business_id,
            cash_movement_id
        ),

    CONSTRAINT uq_order_payments_sale_payment
        UNIQUE (
            business_id,
            sale_payment_id
        ),

    CONSTRAINT fk_order_payments_batch
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

    CONSTRAINT fk_order_payments_method
        FOREIGN KEY (
            business_id,
            payment_method_id
        )
        REFERENCES payment_methods (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_payments_processed_by
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

    CONSTRAINT fk_order_payments_cash_movement
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

    CONSTRAINT fk_order_payments_sale_payment
        FOREIGN KEY (
            business_id,
            sale_payment_id
        )
        REFERENCES sale_payments (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_payments_type
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

    CONSTRAINT chk_order_payments_amounts
        CHECK (
            amount > 0
            AND tendered_amount >= amount
            AND change_amount >= 0
            AND change_amount = tendered_amount - amount
        ),

    CONSTRAINT chk_order_payments_non_cash_change
        CHECK (
            payment_type = 'CASH'
            OR (
                tendered_amount = amount
                AND change_amount = 0
                AND allows_change = FALSE
            )
        ),

    CONSTRAINT chk_order_payments_cash_flags
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

    CONSTRAINT chk_order_payments_reference
        CHECK (
            requires_reference = FALSE
            OR (
                reference IS NOT NULL
                AND CHAR_LENGTH(TRIM(reference)) > 0
            )
        ),

    CONSTRAINT chk_order_payments_notes
        CHECK (
            notes IS NULL
            OR CHAR_LENGTH(TRIM(notes)) > 0
        ),

    INDEX idx_order_payments_batch (
        business_id,
        payment_batch_id,
        paid_at,
        id
    ),

    INDEX idx_order_payments_method (
        business_id,
        payment_method_id,
        paid_at,
        id
    ),

    INDEX idx_order_payments_processed_by (
        business_id,
        processed_by_membership_id,
        paid_at,
        id
    )
) ENGINE = InnoDB;

-- Permitir que un movimiento de efectivo se origine en el pago
-- anticipado de una orden.

DROP PROCEDURE IF EXISTS migrate_074_cash_movement_source;

DELIMITER $$

CREATE PROCEDURE migrate_074_cash_movement_source()
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
            );
END$$

DELIMITER ;

CALL migrate_074_cash_movement_source();

DROP PROCEDURE IF EXISTS migrate_074_cash_movement_source;

-- Permisos.

INSERT INTO permissions (
    code,
    module,
    name,
    description,
    is_active
)
VALUES
(
    'orders.payments.read',
    'orders',
    'Consultar pagos anticipados',
    'Permite consultar los pagos anticipados asociados a pedidos.',
    TRUE
),
(
    'orders.payments.manage',
    'orders',
    'Verificar pagos anticipados',
    'Permite verificar y registrar pagos antes de enviar pedidos a cocina.',
    TRUE
)
ON DUPLICATE KEY UPDATE
    module = VALUES(module),
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Caja y encargado de pedidos públicos.

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
    r.code IN (
        'CASHIER',
        'PUBLIC_ORDER_MANAGER'
    )
    AND r.is_active = TRUE
    AND p.code IN (
        'orders.payments.read',
        'orders.payments.manage'
    )
    AND p.is_active = TRUE
ON DUPLICATE KEY UPDATE
    is_active = TRUE;

-- ADMIN debe conservar todos los permisos activos.

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
    74,
    '074_create_order_advance_payments.sql',
    NULL,
    'MANUAL',
    'Crea lotes y medios de pago anticipados asociados a órdenes.'
);

-- Verificaciones.

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
        'payment_status',
        'payment_verified_at'
    )
ORDER BY ordinal_position;

SELECT
    table_name
FROM information_schema.tables
WHERE
    table_schema = DATABASE()
    AND table_name IN (
        'order_payment_batches',
        'order_payments'
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
    AND p.code IN (
        'orders.payments.read',
        'orders.payments.manage'
    )
ORDER BY
    r.code,
    p.code;

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 74;

SHOW CREATE TABLE order_payment_batches;
SHOW CREATE TABLE order_payments;
SHOW CREATE TABLE cash_movements;
