-- Migración 067:
-- Registra las reversiones de pagos producidas por la anulación total
-- de una venta y agrega el permiso correspondiente.

USE sazora_db;

CREATE TABLE sale_void_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    sale_id BIGINT UNSIGNED NOT NULL,
    sale_payment_id BIGINT UNSIGNED NOT NULL,
    processed_by_membership_id BIGINT UNSIGNED NOT NULL,
    cash_movement_id BIGINT UNSIGNED NULL,

    payment_method_code VARCHAR(50) NOT NULL,
    payment_method_name VARCHAR(120) NOT NULL,
    payment_type VARCHAR(30) NOT NULL,
    affects_cash BOOLEAN NOT NULL,

    amount DECIMAL(18, 6) NOT NULL,
    reference VARCHAR(120) NULL,
    reason VARCHAR(500) NOT NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_sale_void_payments
        PRIMARY KEY (id),

    CONSTRAINT uq_sale_void_payments_business_payment
        UNIQUE (business_id, id),

    CONSTRAINT uq_sale_void_payments_original_payment
        UNIQUE (business_id, sale_payment_id),

    CONSTRAINT uq_sale_void_payments_cash_movement
        UNIQUE (business_id, cash_movement_id),

    CONSTRAINT fk_sale_void_payments_sale
        FOREIGN KEY (business_id, sale_id)
        REFERENCES sales (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_void_payments_original_payment
        FOREIGN KEY (business_id, sale_payment_id)
        REFERENCES sale_payments (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_void_payments_membership
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

    CONSTRAINT fk_sale_void_payments_cash_movement
        FOREIGN KEY (business_id, cash_movement_id)
        REFERENCES cash_movements (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_sale_void_payments_amount
        CHECK (amount > 0),

    CONSTRAINT chk_sale_void_payments_reason
        CHECK (CHAR_LENGTH(TRIM(reason)) >= 5),

    INDEX idx_sale_void_payments_sale (
        business_id,
        sale_id,
        id
    )
) ENGINE = InnoDB;

INSERT INTO permissions (
    code,
    module,
    name,
    description
)
VALUES (
    'sales.void',
    'sales',
    'Anular ventas',
    'Permite anular una venta completa y revertir sus efectos.'
)
ON DUPLICATE KEY UPDATE
    module = VALUES(module),
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Administrador.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code = 'sales.void'
WHERE
    r.code = 'ADMIN'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- Cajero.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code = 'sales.void'
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
    67,
    '067_create_sale_voids.sql',
    NULL,
    'MANUAL',
    'Agrega anulaciones auditables de ventas y el permiso sales.void.'
);

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 67;

SHOW CREATE TABLE sale_void_payments;
