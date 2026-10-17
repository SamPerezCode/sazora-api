USE sazora_db;

-- =========================================================
-- Migración 050
-- Distinguir devoluciones de cliente y a proveedor
-- =========================================================

ALTER TABLE inventory_movements
    ADD COLUMN return_kind VARCHAR(30) NULL
        AFTER movement_type;

-- Los movimientos RETURN anteriores solamente permitían entradas,
-- por lo que se consideran devoluciones de clientes.

SET @previous_sql_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

UPDATE inventory_movements
SET return_kind = 'CUSTOMER_RETURN'
WHERE
    movement_type = 'RETURN'
    AND return_kind IS NULL;

SET SQL_SAFE_UPDATES = @previous_sql_safe_updates;

ALTER TABLE inventory_movements
    ADD CONSTRAINT chk_inventory_movement_return_kind
        CHECK (
            (
                movement_type = 'RETURN'
                AND return_kind IN (
                    'CUSTOMER_RETURN',
                    'SUPPLIER_RETURN'
                )
            )
            OR
            (
                movement_type <> 'RETURN'
                AND return_kind IS NULL
            )
        );

CREATE INDEX idx_inventory_movements_return_kind
    ON inventory_movements (
        business_id,
        return_kind,
        created_at
    );

SHOW CREATE TABLE inventory_movements;
