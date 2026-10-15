-- Migración 046:
-- Configura el flujo de cocina por punto de venta.
--
-- PRINT_ONLY:
-- La cocina trabaja con comandas impresas y la orden se entrega
-- mediante el flujo simplificado de Ventas/Meseros.
--
-- PRINT_AND_SCREEN:
-- La cocina usa comandas impresas y la pantalla de cocina.
--
-- La orden conserva una copia del modo con el que fue confirmada.

USE sazora_db;

CREATE TABLE IF NOT EXISTS location_kitchen_settings (
    business_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,

    workflow_mode VARCHAR(30) NOT NULL
        DEFAULT 'PRINT_AND_SCREEN',

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_location_kitchen_settings
        PRIMARY KEY (
            business_id,
            location_id
        ),

    CONSTRAINT fk_location_kitchen_settings_location
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

    CONSTRAINT chk_location_kitchen_settings_mode
        CHECK (
            workflow_mode IN (
                'PRINT_ONLY',
                'PRINT_AND_SCREEN'
            )
        )
) ENGINE = InnoDB;

-- Conserva el funcionamiento actual para los puntos de venta existentes.
INSERT IGNORE INTO location_kitchen_settings (
    business_id,
    location_id,
    workflow_mode
)
SELECT
    business_id,
    id,
    'PRINT_AND_SCREEN'
FROM business_locations
WHERE location_type = 'POINT_OF_SALE';

ALTER TABLE orders
    ADD COLUMN kitchen_workflow_mode VARCHAR(30) NULL
        AFTER status;

-- Las órdenes históricas que ya salieron del estado OPEN
-- conservarán el comportamiento actual con pantalla.
UPDATE orders
SET kitchen_workflow_mode = 'PRINT_AND_SCREEN'
WHERE
    id > 0
    AND status <> 'OPEN'
    AND kitchen_workflow_mode IS NULL;

ALTER TABLE orders
    ADD CONSTRAINT chk_orders_kitchen_workflow_mode
        CHECK (
            kitchen_workflow_mode IS NULL
            OR kitchen_workflow_mode IN (
                'PRINT_ONLY',
                'PRINT_AND_SCREEN'
            )
        );

SELECT
    bl.id AS location_id,
    bl.code,
    bl.name,
    lks.workflow_mode
FROM business_locations AS bl
LEFT JOIN location_kitchen_settings AS lks
    ON lks.business_id = bl.business_id
    AND lks.location_id = bl.id
WHERE bl.location_type = 'POINT_OF_SALE'
ORDER BY bl.business_id, bl.name;

SELECT
    status,
    kitchen_workflow_mode,
    COUNT(*) AS total
FROM orders
GROUP BY
    status,
    kitchen_workflow_mode
ORDER BY status, kitchen_workflow_mode;

SHOW CREATE TABLE location_kitchen_settings;
SHOW CREATE TABLE orders;
