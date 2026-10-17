USE sazora_db;

-- =========================================================
-- 1. Información documental y totales de la compra
-- =========================================================

ALTER TABLE inventory_movements
    ADD COLUMN supplier_name VARCHAR(160) NULL
        AFTER external_reference,

    ADD COLUMN supplier_document VARCHAR(80) NULL
        AFTER supplier_name,

    ADD COLUMN document_date DATE NULL
        AFTER supplier_document,

    ADD COLUMN purchase_gross_total DECIMAL(24, 6) NULL
        AFTER document_date,

    ADD COLUMN purchase_discount_total DECIMAL(24, 6) NULL
        AFTER purchase_gross_total,

    ADD COLUMN purchase_additional_cost_total DECIMAL(24, 6) NULL
        AFTER purchase_discount_total,

    ADD COLUMN purchase_net_total DECIMAL(24, 6) NULL
        AFTER purchase_additional_cost_total,

    ADD COLUMN purchase_cost_status VARCHAR(30) NULL
        AFTER purchase_net_total;

-- =========================================================
-- 2. Composición económica por línea
-- =========================================================

ALTER TABLE inventory_movement_lines
    ADD COLUMN gross_cost DECIMAL(24, 6) NULL
        AFTER purchase_conversion_factor,

    ADD COLUMN discount_amount DECIMAL(24, 6) NULL
        AFTER gross_cost,

    ADD COLUMN additional_cost_amount DECIMAL(24, 6) NULL
        AFTER discount_amount;

-- =========================================================
-- 3. Recuperar compras valoradas creadas con migración 048
-- =========================================================
-- MySQL Workbench puede tener habilitado safe update mode.
SET @previous_sql_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

UPDATE inventory_movement_lines AS iml
INNER JOIN inventory_movements AS im
    ON im.business_id = iml.business_id
    AND im.id = iml.movement_id
SET
    iml.gross_cost = iml.total_cost,
    iml.discount_amount = 0.000000,
    iml.additional_cost_amount = 0.000000
WHERE
    im.movement_type = 'PURCHASE'
    AND iml.cost_status = 'VALUED'
    AND iml.total_cost IS NOT NULL
    AND iml.gross_cost IS NULL;

UPDATE inventory_movements AS im
INNER JOIN (
    SELECT
        iml.business_id,
        iml.movement_id,
        SUM(iml.gross_cost) AS gross_total,
        SUM(iml.discount_amount) AS discount_total,
        SUM(iml.additional_cost_amount) AS additional_cost_total,
        SUM(iml.total_cost) AS net_total
    FROM inventory_movement_lines AS iml
    WHERE
        iml.cost_status = 'VALUED'
        AND iml.gross_cost IS NOT NULL
    GROUP BY
        iml.business_id,
        iml.movement_id
) AS totals
    ON totals.business_id = im.business_id
    AND totals.movement_id = im.id
SET
    im.purchase_gross_total = totals.gross_total,
    im.purchase_discount_total = totals.discount_total,
    im.purchase_additional_cost_total =
        totals.additional_cost_total,
    im.purchase_net_total = totals.net_total,
    im.purchase_cost_status = 'VALUED'
WHERE
    im.movement_type = 'PURCHASE';

UPDATE inventory_movements

UPDATE inventory_movements
SET purchase_cost_status = 'LEGACY_UNVALUED'
WHERE
    movement_type = 'PURCHASE'
    AND purchase_cost_status IS NULL;

SET SQL_SAFE_UPDATES = @previous_sql_safe_updates;

-- =========================================================
-- 4. Restricciones económicas
-- =========================================================

ALTER TABLE inventory_movements
    ADD CONSTRAINT chk_inventory_purchase_cost_status
        CHECK (
            purchase_cost_status IS NULL
            OR purchase_cost_status IN (
                'LEGACY_UNVALUED',
                'VALUED'
            )
        ),

    ADD CONSTRAINT chk_inventory_purchase_totals
        CHECK (
            (
                purchase_cost_status IS NULL
                AND purchase_gross_total IS NULL
                AND purchase_discount_total IS NULL
                AND purchase_additional_cost_total IS NULL
                AND purchase_net_total IS NULL
            )
            OR
            (
                purchase_cost_status = 'LEGACY_UNVALUED'
                AND purchase_gross_total IS NULL
                AND purchase_discount_total IS NULL
                AND purchase_additional_cost_total IS NULL
                AND purchase_net_total IS NULL
            )
            OR
            (
                purchase_cost_status = 'VALUED'
                AND purchase_gross_total > 0
                AND purchase_discount_total >= 0
                AND purchase_discount_total
                    <= purchase_gross_total
                AND purchase_additional_cost_total >= 0
                AND purchase_net_total > 0
                AND purchase_net_total = ROUND(
                    purchase_gross_total
                    - purchase_discount_total
                    + purchase_additional_cost_total,
                    6
                )
            )
        );

ALTER TABLE inventory_movement_lines
    ADD CONSTRAINT chk_inventory_purchase_line_costs
        CHECK (
            (
                gross_cost IS NULL
                AND discount_amount IS NULL
                AND additional_cost_amount IS NULL
            )
            OR
            (
                gross_cost > 0
                AND discount_amount >= 0
                AND discount_amount <= gross_cost
                AND additional_cost_amount >= 0
                AND total_cost > 0
                AND total_cost = ROUND(
                    gross_cost
                    - discount_amount
                    + additional_cost_amount,
                    6
                )
            )
        );

CREATE INDEX idx_inventory_purchases_supplier
    ON inventory_movements (
        business_id,
        supplier_name,
        created_at
    );

CREATE INDEX idx_inventory_purchases_document_date
    ON inventory_movements (
        business_id,
        document_date,
        created_at
    );

SHOW CREATE TABLE inventory_movements;
SHOW CREATE TABLE inventory_movement_lines;
