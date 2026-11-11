-- Migración 068:
-- Crea devoluciones parciales y totales de ventas.
-- Conserva snapshots financieros, fiscales, de costo y de pago.

USE sazora_db;

CREATE TABLE sale_refunds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    sale_id BIGINT UNSIGNED NOT NULL,
    cash_session_id BIGINT UNSIGNED NOT NULL,
    processed_by_membership_id BIGINT UNSIGNED NOT NULL,

    refund_kind VARCHAR(20) NOT NULL,

    reason VARCHAR(500) NOT NULL,

    net_amount DECIMAL(18, 6) NOT NULL,
    tax_amount DECIMAL(18, 6) NOT NULL,
    total_amount DECIMAL(18, 6) NOT NULL,

    cost_amount DECIMAL(24, 6) NULL,

    refunded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_sale_refunds
        PRIMARY KEY (id),

    CONSTRAINT uq_sale_refunds_business_refund
        UNIQUE (business_id, id),

    CONSTRAINT fk_sale_refunds_sale
        FOREIGN KEY (business_id, sale_id)
        REFERENCES sales (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_refunds_cash_session
        FOREIGN KEY (business_id, cash_session_id)
        REFERENCES cash_sessions (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_refunds_processed_by
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

    CONSTRAINT chk_sale_refunds_kind
        CHECK (
            refund_kind IN (
                'PARTIAL',
                'FULL'
            )
        ),

    CONSTRAINT chk_sale_refunds_reason
        CHECK (
            CHAR_LENGTH(TRIM(reason)) >= 5
        ),

    CONSTRAINT chk_sale_refunds_amounts
        CHECK (
            net_amount >= 0
            AND tax_amount >= 0
            AND total_amount > 0
            AND net_amount + tax_amount = total_amount
        ),

    CONSTRAINT chk_sale_refunds_cost
        CHECK (
            cost_amount IS NULL
            OR cost_amount >= 0
        ),

    INDEX idx_sale_refunds_sale (
        business_id,
        sale_id,
        refunded_at,
        id
    ),

    INDEX idx_sale_refunds_session (
        business_id,
        cash_session_id,
        refunded_at,
        id
    )
) ENGINE = InnoDB;

CREATE TABLE sale_refund_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    refund_id BIGINT UNSIGNED NOT NULL,
    sale_item_id BIGINT UNSIGNED NOT NULL,

    product_id BIGINT UNSIGNED NOT NULL,
    product_name VARCHAR(150) NOT NULL,

    quantity SMALLINT UNSIGNED NOT NULL,

    restore_inventory BOOLEAN NOT NULL DEFAULT FALSE,
    inventory_movement_id BIGINT UNSIGNED NULL,

    net_amount DECIMAL(18, 6) NOT NULL,
    tax_amount DECIMAL(18, 6) NOT NULL,
    total_amount DECIMAL(18, 6) NOT NULL,

    cost_amount DECIMAL(24, 6) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_sale_refund_items
        PRIMARY KEY (id),

    CONSTRAINT uq_sale_refund_items_business_item
        UNIQUE (business_id, id),

    CONSTRAINT uq_sale_refund_items_refund_sale_item
        UNIQUE (
            business_id,
            refund_id,
            sale_item_id
        ),

    CONSTRAINT fk_sale_refund_items_refund
        FOREIGN KEY (business_id, refund_id)
        REFERENCES sale_refunds (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_refund_items_sale_item
        FOREIGN KEY (business_id, sale_item_id)
        REFERENCES sale_items (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_refund_items_product
        FOREIGN KEY (business_id, product_id)
        REFERENCES products (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_refund_items_inventory_movement
        FOREIGN KEY (
            business_id,
            inventory_movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_sale_refund_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_sale_refund_items_product_name
        CHECK (
            CHAR_LENGTH(TRIM(product_name)) > 0
        ),

    CONSTRAINT chk_sale_refund_items_amounts
        CHECK (
            net_amount >= 0
            AND tax_amount >= 0
            AND total_amount > 0
            AND net_amount + tax_amount = total_amount
        ),

    CONSTRAINT chk_sale_refund_items_cost
        CHECK (
            cost_amount IS NULL
            OR cost_amount >= 0
        ),

    INDEX idx_sale_refund_items_sale_item (
        business_id,
        sale_item_id,
        refund_id
    ),

    INDEX idx_sale_refund_items_product (
        business_id,
        product_id,
        refund_id
    )
) ENGINE = InnoDB;

CREATE TABLE sale_refund_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    refund_id BIGINT UNSIGNED NOT NULL,
    sale_payment_id BIGINT UNSIGNED NOT NULL,
    processed_by_membership_id BIGINT UNSIGNED NOT NULL,
    cash_movement_id BIGINT UNSIGNED NULL,

    payment_method_code VARCHAR(50) NOT NULL,
    payment_method_name VARCHAR(120) NOT NULL,
    payment_type VARCHAR(30) NOT NULL,

    requires_reference BOOLEAN NOT NULL,
    affects_cash BOOLEAN NOT NULL,

    amount DECIMAL(18, 6) NOT NULL,

    reference VARCHAR(120) NULL,
    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_sale_refund_payments
        PRIMARY KEY (id),

    CONSTRAINT uq_sale_refund_payments_business_payment
        UNIQUE (business_id, id),

    CONSTRAINT uq_sale_refund_payments_refund_original
        UNIQUE (
            business_id,
            refund_id,
            sale_payment_id
        ),

    CONSTRAINT uq_sale_refund_payments_cash_movement
        UNIQUE (
            business_id,
            cash_movement_id
        ),

    CONSTRAINT fk_sale_refund_payments_refund
        FOREIGN KEY (business_id, refund_id)
        REFERENCES sale_refunds (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_refund_payments_sale_payment
        FOREIGN KEY (business_id, sale_payment_id)
        REFERENCES sale_payments (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_refund_payments_processed_by
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

    CONSTRAINT fk_sale_refund_payments_cash_movement
        FOREIGN KEY (business_id, cash_movement_id)
        REFERENCES cash_movements (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_sale_refund_payments_amount
        CHECK (amount > 0),

    CONSTRAINT chk_sale_refund_payments_reference
        CHECK (
            reference IS NULL
            OR CHAR_LENGTH(TRIM(reference)) > 0
        ),

    INDEX idx_sale_refund_payments_refund (
        business_id,
        refund_id,
        id
    ),

    INDEX idx_sale_refund_payments_original (
        business_id,
        sale_payment_id,
        refund_id
    )
) ENGINE = InnoDB;

INSERT INTO permissions (
    code,
    module,
    name,
    description
)
VALUES (
    'sales.refunds.create',
    'sales',
    'Registrar devoluciones',
    'Permite registrar devoluciones parciales o totales de ventas.'
)
ON DUPLICATE KEY UPDATE
    module = 'sales',
    name = 'Registrar devoluciones',
    description =
        'Permite registrar devoluciones parciales o totales de ventas.',
    is_active = TRUE;

INSERT INTO permissions (
    code,
    module,
    name,
    description
)
VALUES (
    'sales.refunds.read',
    'sales',
    'Consultar devoluciones',
    'Permite consultar las devoluciones registradas sobre ventas.'
)
ON DUPLICATE KEY UPDATE
    module = 'sales',
    name = 'Consultar devoluciones',
    description =
        'Permite consultar las devoluciones registradas sobre ventas.',
    is_active = TRUE;

-- Administrador: ambos permisos.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'sales.refunds.create',
        'sales.refunds.read'
    )
WHERE
    r.code = 'ADMIN'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- Cajero: ambos permisos.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'sales.refunds.create',
        'sales.refunds.read'
    )
WHERE
    r.code = 'CASHIER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

INSERT IGNORE INTO schema_migrations (
    migration_number,
    filename,
    checksum_sha256,
    execution_source,
    notes
)
VALUES (
    68,
    '068_create_sale_refunds.sql',
    NULL,
    'MANUAL',
    'Crea devoluciones de ventas, artículos, pagos y permisos relacionados.'
);

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 68;

SHOW CREATE TABLE sale_refunds;
SHOW CREATE TABLE sale_refund_items;
SHOW CREATE TABLE sale_refund_payments;
