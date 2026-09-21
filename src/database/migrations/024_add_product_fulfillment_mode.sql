-- Migración 024: modo de preparación y entrega de los productos.
--
-- PREPARE_TO_ORDER:
-- El producto debe prepararse después de confirmar la orden.
--
-- READY_TO_SERVE:
-- El producto ya está preparado y solamente debe despacharse.

USE sazora_db;

ALTER TABLE products
    ADD COLUMN fulfillment_mode VARCHAR(30)
        NOT NULL
        DEFAULT 'PREPARE_TO_ORDER'
        AFTER preparation_area_id,

    ADD CONSTRAINT chk_products_fulfillment_mode
        CHECK (
            fulfillment_mode IN (
                'PREPARE_TO_ORDER',
                'READY_TO_SERVE'
            )
        );

ALTER TABLE order_items
    ADD COLUMN fulfillment_mode VARCHAR(30)
        NOT NULL
        DEFAULT 'PREPARE_TO_ORDER'
        AFTER preparation_area_id,

    ADD CONSTRAINT chk_order_items_fulfillment_mode
        CHECK (
            fulfillment_mode IN (
                'PREPARE_TO_ORDER',
                'READY_TO_SERVE'
            )
        );

-- Los productos READY_TO_SERVE podrán comenzar directamente en READY.
ALTER TABLE kitchen_ticket_items
    DROP CHECK chk_kitchen_ticket_items_status_dates,
    DROP CHECK chk_kitchen_ticket_items_date_order;

ALTER TABLE kitchen_ticket_items
    ADD CONSTRAINT chk_kitchen_ticket_items_status_dates
        CHECK (
            (
                preparation_status = 'PENDING'
                AND started_at IS NULL
                AND ready_at IS NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'IN_PREPARATION'
                AND started_at IS NOT NULL
                AND ready_at IS NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'READY'
                AND ready_at IS NOT NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'DELIVERED'
                AND ready_at IS NOT NULL
                AND delivered_at IS NOT NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'CANCELLED'
                AND delivered_at IS NULL
                AND cancelled_at IS NOT NULL
            )
        ),

    ADD CONSTRAINT chk_kitchen_ticket_items_date_order
        CHECK (
            (
                started_at IS NULL
                OR ready_at IS NULL
                OR ready_at >= started_at
            )
            AND
            (
                ready_at IS NULL
                OR delivered_at IS NULL
                OR delivered_at >= ready_at
            )
        );

-- El primer evento histórico podrá ser PENDING o READY.
ALTER TABLE kitchen_item_status_history
    DROP CHECK chk_kitchen_item_status_history_transition;

ALTER TABLE kitchen_item_status_history
    ADD CONSTRAINT chk_kitchen_item_status_history_transition
        CHECK (
            (
                previous_status IS NULL
                AND new_status IN ('PENDING', 'READY')
            )
            OR
            (
                previous_status IS NOT NULL
                AND previous_status <> new_status
            )
        );

DESCRIBE products;
DESCRIBE order_items;
SHOW CREATE TABLE kitchen_ticket_items;
SHOW CREATE TABLE kitchen_item_status_history;




-- Ver productos
SELECT
    id,
    name,
    preparation_area_id,
    fulfillment_mode
FROM products
WHERE business_id = 1
ORDER BY id;

-- Actualizar producto con el id 1
UPDATE products
SET fulfillment_mode = 'READY_TO_SERVE'
WHERE business_id = 1
  AND id = 1;
