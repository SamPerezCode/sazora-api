USE sazora_db;

-- =========================================================
-- 1. Saldo físico y económico por artículo y ubicación
-- =========================================================

CREATE TABLE inventory_location_balances (
    business_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    current_stock DECIMAL(18, 3) NOT NULL
        DEFAULT 0.000,

    minimum_stock DECIMAL(18, 3) NOT NULL
        DEFAULT 0.000,

    average_unit_cost DECIMAL(24, 6) NULL,
    inventory_value DECIMAL(24, 6) NULL,

    valuation_status VARCHAR(20) NOT NULL
        DEFAULT 'UNVALUED',

    migrated_from_legacy BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_location_balances
        PRIMARY KEY (
            business_id,
            location_id,
            inventory_item_id
        ),

    CONSTRAINT fk_inventory_location_balances_location
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

    CONSTRAINT fk_inventory_location_balances_item
        FOREIGN KEY (
            business_id,
            inventory_item_id
        )
        REFERENCES inventory_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_location_minimum_stock
        CHECK (minimum_stock >= 0),

    CONSTRAINT chk_inventory_location_average_cost
        CHECK (
            average_unit_cost IS NULL
            OR average_unit_cost >= 0
        ),

    CONSTRAINT chk_inventory_location_valuation_status
        CHECK (
            valuation_status IN (
                'UNVALUED',
                'VALUED'
            )
        ),

    CONSTRAINT chk_inventory_location_valuation_data
        CHECK (
            (
                valuation_status = 'UNVALUED'
                AND average_unit_cost IS NULL
                AND inventory_value IS NULL
            )
            OR
            (
                valuation_status = 'VALUED'
                AND (
                    (
                        current_stock = 0
                        AND average_unit_cost IS NULL
                        AND inventory_value = 0
                    )
                    OR
                    (
                        average_unit_cost IS NOT NULL
                        AND inventory_value IS NOT NULL
                    )
                )
            )
        ),

    INDEX idx_inventory_location_balances_item (
        business_id,
        inventory_item_id,
        location_id
    ),

    INDEX idx_inventory_location_balances_location_stock (
        business_id,
        location_id,
        current_stock
    ),

    INDEX idx_inventory_location_balances_valuation (
        business_id,
        location_id,
        valuation_status
    )
) ENGINE = InnoDB;

-- =========================================================
-- 2. Historial de valoraciones y correcciones de costo
-- =========================================================

CREATE TABLE inventory_valuation_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    event_type VARCHAR(30) NOT NULL,

    quantity_snapshot DECIMAL(18, 3) NOT NULL,

    previous_average_unit_cost DECIMAL(24, 6) NULL,
    new_average_unit_cost DECIMAL(24, 6) NOT NULL,

    previous_inventory_value DECIMAL(24, 6) NULL,
    new_inventory_value DECIMAL(24, 6) NOT NULL,

    reason VARCHAR(500) NOT NULL,

    created_by_membership_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_valuation_events
        PRIMARY KEY (id),

    CONSTRAINT fk_inventory_valuation_events_balance
        FOREIGN KEY (
            business_id,
            location_id,
            inventory_item_id
        )
        REFERENCES inventory_location_balances (
            business_id,
            location_id,
            inventory_item_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_valuation_events_membership
        FOREIGN KEY (
            business_id,
            created_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_valuation_event_type
        CHECK (
            event_type IN (
                'INITIAL_VALUATION',
                'COST_CORRECTION'
            )
        ),

    CONSTRAINT chk_inventory_valuation_event_cost
        CHECK (
            new_average_unit_cost >= 0
            AND new_inventory_value >= 0
        ),

    CONSTRAINT chk_inventory_valuation_event_reason
        CHECK (
            CHAR_LENGTH(TRIM(reason)) > 0
        ),

    INDEX idx_inventory_valuation_events_item (
        business_id,
        inventory_item_id,
        location_id,
        created_at
    ),

    INDEX idx_inventory_valuation_events_location (
        business_id,
        location_id,
        created_at
    )
) ENGINE = InnoDB;

-- =========================================================
-- 3. Preparar movimientos para ubicación y costos
-- =========================================================

ALTER TABLE inventory_movements
    ADD COLUMN location_id BIGINT UNSIGNED NULL
        AFTER business_id,

    ADD CONSTRAINT fk_inventory_movements_location
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

    ADD INDEX idx_inventory_movements_location_created (
        business_id,
        location_id,
        created_at
    );

ALTER TABLE inventory_movement_lines
    ADD COLUMN unit_cost DECIMAL(24, 6) NULL
        AFTER quantity,

    ADD COLUMN total_cost DECIMAL(24, 6) NULL
        AFTER unit_cost,

    ADD COLUMN average_unit_cost_before DECIMAL(24, 6) NULL
        AFTER balance_after,

    ADD COLUMN average_unit_cost_after DECIMAL(24, 6) NULL
        AFTER average_unit_cost_before,

    ADD COLUMN inventory_value_before DECIMAL(24, 6) NULL
        AFTER average_unit_cost_after,

    ADD COLUMN inventory_value_after DECIMAL(24, 6) NULL
        AFTER inventory_value_before,

    ADD COLUMN cost_status VARCHAR(30) NOT NULL
        DEFAULT 'UNVALUED_LEGACY'
        AFTER inventory_value_after,

    ADD CONSTRAINT chk_inventory_movement_line_cost_status
        CHECK (
            cost_status IN (
                'UNVALUED_LEGACY',
                'VALUED'
            )
        ),

    ADD CONSTRAINT chk_inventory_movement_line_cost_data
        CHECK (
            (
                cost_status = 'UNVALUED_LEGACY'
                AND unit_cost IS NULL
                AND total_cost IS NULL
                AND average_unit_cost_before IS NULL
                AND average_unit_cost_after IS NULL
                AND inventory_value_before IS NULL
                AND inventory_value_after IS NULL
            )
            OR
            (
                cost_status = 'VALUED'
                AND unit_cost IS NOT NULL
                AND total_cost IS NOT NULL
                AND average_unit_cost_after IS NOT NULL
                AND inventory_value_after IS NOT NULL
            )
        );

-- =========================================================
-- 4. Migrar existencias globales actuales
-- =========================================================
--
-- Como el sistema anterior no conocía ubicación, el saldo existente se
-- asigna a la ubicación de inventario más antigua del negocio.
--
-- Se marca migrated_from_legacy = TRUE.
--
-- Los saldos distintos de cero quedan UNVALUED porque no conocemos su
-- costo histórico. Los saldos en cero se consideran VALUED con valor 0.
-- =========================================================

INSERT INTO inventory_location_balances (
    business_id,
    location_id,
    inventory_item_id,
    current_stock,
    minimum_stock,
    average_unit_cost,
    inventory_value,
    valuation_status,
    migrated_from_legacy
)
SELECT
    ii.business_id,

    (
        SELECT MIN(bl.id)
        FROM business_locations AS bl
        WHERE
            bl.business_id = ii.business_id
            AND bl.is_inventory_location = TRUE
    ) AS location_id,

    ii.id,
    ii.current_stock,
    ii.minimum_stock,

    NULL AS average_unit_cost,

    CASE
        WHEN ii.current_stock = 0
            THEN 0.000000
        ELSE NULL
    END AS inventory_value,

    CASE
        WHEN ii.current_stock = 0
            THEN 'VALUED'
        ELSE 'UNVALUED'
    END AS valuation_status,

    TRUE AS migrated_from_legacy

FROM inventory_items AS ii

WHERE EXISTS (
    SELECT 1
    FROM business_locations AS bl
    WHERE
        bl.business_id = ii.business_id
        AND bl.is_inventory_location = TRUE
);

SELECT
    ilb.business_id,
    ilb.location_id,
    bl.code AS location_code,
    ilb.inventory_item_id,
    ii.name AS inventory_item_name,
    ilb.current_stock,
    ilb.average_unit_cost,
    ilb.inventory_value,
    ilb.valuation_status,
    ilb.migrated_from_legacy
FROM inventory_location_balances AS ilb
INNER JOIN business_locations AS bl
    ON bl.business_id = ilb.business_id
    AND bl.id = ilb.location_id
INNER JOIN inventory_items AS ii
    ON ii.business_id = ilb.business_id
    AND ii.id = ilb.inventory_item_id
ORDER BY
    ilb.business_id,
    bl.name,
    ii.name;

SHOW CREATE TABLE inventory_location_balances;
SHOW CREATE TABLE inventory_valuation_events;
SHOW CREATE TABLE inventory_movements;
SHOW CREATE TABLE inventory_movement_lines;
