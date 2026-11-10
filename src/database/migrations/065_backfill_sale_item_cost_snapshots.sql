-- Migración 065:
-- Completa el snapshot histórico de costo y utilidad de los artículos
-- de ventas existentes cuando el inventario fue descontado y valorado.
--
-- No modifica artículos que ya tengan snapshot de costo.
-- Los productos sin inventario vinculado permanecen con costo NULL.

USE sazora_db;

UPDATE sale_items AS si

INNER JOIN (
    SELECT
        im.business_id,
        im.source_id AS order_item_id,
        SUM(iml.total_cost) AS cost_total

    FROM inventory_movements AS im

    INNER JOIN inventory_movement_lines AS iml
        ON iml.business_id = im.business_id
        AND iml.movement_id = im.id

    WHERE
        im.movement_type = 'SALE'
        AND im.source_type = 'ORDER_ITEM'
        AND iml.direction = 'OUT'

    GROUP BY
        im.business_id,
        im.source_id

    HAVING
        COUNT(*) = SUM(
            CASE
                WHEN
                    iml.cost_status = 'VALUED'
                    AND iml.total_cost IS NOT NULL
                    THEN 1
                ELSE 0
            END
        )
) AS inventory_cost
    ON inventory_cost.business_id = si.business_id
    AND inventory_cost.order_item_id = CAST(si.order_item_id AS CHAR)

SET
    si.cost_total = inventory_cost.cost_total,
    si.gross_profit_amount =
        si.line_net_total - inventory_cost.cost_total

WHERE
    si.id > 0
    AND si.cost_total IS NULL
    AND si.gross_profit_amount IS NULL;

INSERT IGNORE INTO schema_migrations (
    migration_number,
    filename,
    checksum_sha256,
    execution_source,
    notes
)
VALUES (
    65,
    '065_backfill_sale_item_cost_snapshots.sql',
    NULL,
    'MANUAL',
    'Completa costos y utilidad de ventas existentes usando movimientos de inventario valorados.'
);

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 65;

SELECT
    si.id,
    si.sale_id,
    si.order_item_id,
    si.product_name,
    si.line_net_total,
    si.cost_total,
    si.gross_profit_amount
FROM sale_items AS si
ORDER BY si.id;
