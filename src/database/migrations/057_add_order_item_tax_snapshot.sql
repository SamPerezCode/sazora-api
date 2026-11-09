-- --------------------------------------------------------------------------
-- ==============================================================
-- ARCHIVO: 057_add_order_item_tax_snapshot.sql
-- ==============================================================
-- Migración 057:


USE sazora_db;

ALTER TABLE order_items
    ADD COLUMN tax_class_id BIGINT UNSIGNED NULL
        AFTER product_id,

    ADD COLUMN tax_code VARCHAR(50) NULL
        AFTER unit_price,

    ADD COLUMN tax_name VARCHAR(120) NULL
        AFTER tax_code,

    ADD COLUMN tax_type VARCHAR(30) NULL
        AFTER tax_name,

    ADD COLUMN tax_rate DECIMAL(7, 4) NOT NULL DEFAULT 0.0000
        AFTER tax_type,

    ADD COLUMN price_includes_tax BOOLEAN NOT NULL DEFAULT TRUE
        AFTER tax_rate,

    ADD COLUMN unit_net_price DECIMAL(14, 6) NOT NULL DEFAULT 0.000000
        AFTER price_includes_tax,

    ADD COLUMN unit_tax_amount DECIMAL(14, 6) NOT NULL DEFAULT 0.000000
        AFTER unit_net_price,

    ADD CONSTRAINT fk_order_items_tax_class
        FOREIGN KEY (business_id, tax_class_id)
        REFERENCES tax_classes (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    ADD CONSTRAINT chk_order_items_tax_type
        CHECK (
            tax_type IS NULL
            OR tax_type IN (
                'VAT',
                'CONSUMPTION',
                'EXEMPT',
                'EXCLUDED',
                'NON_TAXED',
                'OTHER'
            )
        ),

    ADD CONSTRAINT chk_order_items_tax_rate
        CHECK (
            tax_rate >= 0.0000
            AND tax_rate <= 100.0000
        ),

    ADD CONSTRAINT chk_order_items_unit_net_price
        CHECK (unit_net_price >= 0.000000),

    ADD CONSTRAINT chk_order_items_unit_tax_amount
        CHECK (unit_tax_amount >= 0.000000),

    ADD CONSTRAINT chk_order_items_tax_snapshot
        CHECK (
            (
                tax_class_id IS NULL
                AND tax_code IS NULL
                AND tax_name IS NULL
                AND tax_type IS NULL
                AND tax_rate = 0.0000
                AND unit_tax_amount = 0.000000
            )
            OR
            (
                tax_class_id IS NOT NULL
                AND tax_code IS NOT NULL
                AND tax_name IS NOT NULL
                AND tax_type IS NOT NULL
            )
        ),

    ADD INDEX idx_order_items_business_tax_class (
        business_id,
        tax_class_id
    );

-- Las ventas existentes se consideran ventas históricas sin impuesto
-- desglosado. Su precio completo se conserva como valor neto.

UPDATE order_items
SET
    tax_rate = 0.0000,
    price_includes_tax = TRUE,
    unit_net_price = unit_price,
    unit_tax_amount = 0.000000
WHERE
    id > 0
    AND tax_class_id IS NULL;

SHOW COLUMNS
FROM order_items
WHERE Field IN (
    'tax_class_id',
    'tax_code',
    'tax_name',
    'tax_type',
    'tax_rate',
    'price_includes_tax',
    'unit_net_price',
    'unit_tax_amount'
);

SELECT
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'order_items'
    AND CONSTRAINT_NAME IN (
        'fk_order_items_tax_class',
        'chk_order_items_tax_type',
        'chk_order_items_tax_rate',
        'chk_order_items_unit_net_price',
        'chk_order_items_unit_tax_amount',
        'chk_order_items_tax_snapshot'
    )
ORDER BY CONSTRAINT_NAME;
