-- Migración 066:
-- Corrige el snapshot de costo de las ventas descontando las
-- cancelaciones de productos realizadas antes de cerrar la venta.
--
-- Permite corregir tanto snapshots vacíos como snapshots calculados
-- únicamente con el movimiento original de salida.

USE sazora_db;

UPDATE sale_items AS si

INNER JOIN (
    SELECT
        im.business_id,

        CASE
            WHEN im.source_type = 'ORDER_ITEM'
                THEN im.source_id
            ELSE SUBSTRING_INDEX(im.source_id, ':', 1)
        END AS order_item_id,

        COUNT(iml.id) AS movement_line_count,

        SUM(
            CASE
                WHEN
                    iml.cost_status = 'VALUED'
                    AND iml.total_cost IS NOT NULL
                    THEN 1
                ELSE 0
            END
        ) AS valued_line_count,

        SUM(
            CASE
                WHEN
                    im.movement_type = 'SALE'
                    AND im.source_type = 'ORDER_ITEM'
                    AND iml.direction = 'OUT'
                    THEN iml.total_cost

                WHEN
                    im.movement_type = 'REVERSAL'
                    AND im.source_type = 'ORDER_ITEM_CANCELLATION'
                    AND iml.direction = 'IN'
                    THEN -iml.total_cost

                ELSE 0
            END
        ) AS cost_total

    FROM inventory_movements AS im

    INNER JOIN inventory_movement_lines AS iml
        ON iml.business_id = im.business_id
        AND iml.movement_id = im.id

    WHERE
        (
            im.movement_type = 'SALE'
            AND im.source_type = 'ORDER_ITEM'
            AND iml.direction = 'OUT'
        )
        OR
        (
            im.movement_type = 'REVERSAL'
            AND im.source_type = 'ORDER_ITEM_CANCELLATION'
            AND iml.direction = 'IN'
        )

    GROUP BY
        im.business_id,
        CASE
            WHEN im.source_type = 'ORDER_ITEM'
                THEN im.source_id
            ELSE SUBSTRING_INDEX(im.source_id, ':', 1)
        END

    HAVING
        COUNT(iml.id) = SUM(
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
    AND inventory_cost.order_item_id =
        CAST(si.order_item_id AS CHAR)

SET
    si.cost_total = inventory_cost.cost_total,
    si.gross_profit_amount =
        si.line_net_total - inventory_cost.cost_total

WHERE
    si.id > 0
    AND (
        NOT (
            si.cost_total
            <=> inventory_cost.cost_total
        )
        OR NOT (
            si.gross_profit_amount
            <=> (
                si.line_net_total -
                inventory_cost.cost_total
            )
        )
    );

INSERT IGNORE INTO schema_migrations (
    migration_number,
    filename,
    checksum_sha256,
    execution_source,
    notes
)
VALUES (
    66,
    '066_correct_sale_item_cost_snapshots.sql',
    NULL,
    'MANUAL',
    'Corrige costos y utilidad descontando cancelaciones previas al cierre de la venta.'
);

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 66;

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
