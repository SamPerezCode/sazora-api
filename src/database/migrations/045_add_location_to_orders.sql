-- Migración 045:
-- Asigna cada orden a un punto de venta.
--
-- Las órdenes de mesa heredan la ubicación de su mesa.
-- Las demás órdenes usan la ubicación predeterminada del empleado
-- o, como respaldo para datos históricos, el primer punto de venta activo.

USE sazora_db;

ALTER TABLE orders
    ADD COLUMN location_id BIGINT UNSIGNED NULL
        AFTER business_id;

-- Órdenes de mesa: toman la ubicación de la mesa.
UPDATE orders AS o
INNER JOIN restaurant_tables AS rt
    ON rt.business_id = o.business_id
    AND rt.id = o.restaurant_table_id
SET o.location_id = rt.location_id
WHERE
    o.id > 0
    AND o.location_id IS NULL
    AND o.service_type = 'TABLE';

-- TAKEAWAY y DELIVERY:
-- intentan usar la ubicación predeterminada del empleado.
UPDATE orders AS o
INNER JOIN business_membership_locations AS bml
    ON bml.business_id = o.business_id
    AND bml.business_membership_id = o.opened_by_membership_id
    AND bml.is_default = TRUE
INNER JOIN business_locations AS bl
    ON bl.business_id = bml.business_id
    AND bl.id = bml.location_id
    AND bl.location_type = 'POINT_OF_SALE'
SET o.location_id = bl.id
WHERE
    o.id > 0
    AND o.location_id IS NULL;

-- Respaldo para órdenes históricas sin una ubicación predeterminada válida.
UPDATE orders AS o
INNER JOIN (
    SELECT
        business_id,
        MIN(id) AS location_id
    FROM business_locations
    WHERE
        location_type = 'POINT_OF_SALE'
        AND is_active = TRUE
    GROUP BY business_id
) AS fallback_location
    ON fallback_location.business_id = o.business_id
SET o.location_id = fallback_location.location_id
WHERE
    o.id > 0
    AND o.location_id IS NULL;

-- Esta consulta debe retornar cero antes de continuar.
SELECT
    COUNT(*) AS orders_without_location
FROM orders
WHERE location_id IS NULL;

ALTER TABLE orders
    MODIFY COLUMN location_id BIGINT UNSIGNED NOT NULL;

ALTER TABLE orders
    ADD CONSTRAINT uq_orders_business_location_order
        UNIQUE (
            business_id,
            location_id,
            id
        ),

    ADD CONSTRAINT fk_orders_location
        FOREIGN KEY (
            business_id,
            location_id
        )
        REFERENCES business_locations (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    ADD CONSTRAINT fk_orders_table_location
        FOREIGN KEY (
            business_id,
            location_id,
            restaurant_table_id
        )
        REFERENCES restaurant_tables (
            business_id,
            location_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    ADD INDEX idx_orders_location_status_created (
        business_id,
        location_id,
        status,
        created_at
    ),

    ADD INDEX idx_orders_location_service_created (
        business_id,
        location_id,
        service_type,
        created_at
    );

SELECT
    o.id,
    o.service_type,
    o.status,
    o.restaurant_table_id,
    bl.id AS location_id,
    bl.code AS location_code,
    bl.name AS location_name
FROM orders AS o
INNER JOIN business_locations AS bl
    ON bl.business_id = o.business_id
    AND bl.id = o.location_id
ORDER BY o.id;

SHOW CREATE TABLE orders;
SHOW INDEX FROM orders;
