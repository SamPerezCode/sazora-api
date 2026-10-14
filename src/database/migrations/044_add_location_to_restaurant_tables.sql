-- Migración 044:
-- Asigna cada mesa física a un único punto de venta.
--
-- Una mesa no puede pertenecer a una planta de producción.
-- El código de mesa pasa a ser único por ubicación.

USE sazora_db;

ALTER TABLE restaurant_tables
    ADD COLUMN location_id BIGINT UNSIGNED NULL
        AFTER business_id;

-- Compatibilidad con las mesas existentes:
-- se asignan provisionalmente al primer punto de venta activo del negocio.
--
-- Después de ejecutar la migración se debe verificar esta asignación.
UPDATE restaurant_tables AS rt
INNER JOIN (
    SELECT
        business_id,
        MIN(id) AS location_id
    FROM business_locations
    WHERE
        location_type = 'POINT_OF_SALE'
        AND is_active = TRUE
    GROUP BY business_id
) AS default_sales_location
    ON default_sales_location.business_id = rt.business_id
SET rt.location_id = default_sales_location.location_id
WHERE
    rt.id > 0
    AND rt.location_id IS NULL;

ALTER TABLE restaurant_tables
    MODIFY COLUMN location_id BIGINT UNSIGNED NOT NULL;

ALTER TABLE restaurant_tables
    DROP INDEX uq_restaurant_tables_business_code;

ALTER TABLE restaurant_tables
    DROP INDEX idx_restaurant_tables_business_active_name;

ALTER TABLE restaurant_tables
    ADD CONSTRAINT uq_restaurant_tables_business_location_code
        UNIQUE (
            business_id,
            location_id,
            code
        ),

    ADD CONSTRAINT uq_restaurant_tables_business_location_table
        UNIQUE (
            business_id,
            location_id,
            id
        ),

    ADD CONSTRAINT fk_restaurant_tables_location
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

    ADD INDEX idx_restaurant_tables_location_active_name (
        business_id,
        location_id,
        is_active,
        name
    );

SELECT
    rt.id,
    rt.code,
    rt.name,
    bl.code AS location_code,
    bl.name AS location_name
FROM restaurant_tables AS rt
INNER JOIN business_locations AS bl
    ON bl.business_id = rt.business_id
    AND bl.id = rt.location_id
ORDER BY
    bl.name,
    rt.name;

SHOW CREATE TABLE restaurant_tables;
SHOW INDEX FROM restaurant_tables;
