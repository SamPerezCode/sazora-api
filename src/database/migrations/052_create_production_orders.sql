USE sazora_db;

-- =========================================================
-- Migración 052
-- Órdenes de producción y copia histórica de la receta
-- =========================================================

CREATE TABLE IF NOT EXISTS production_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    recipe_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    batch_quantity DECIMAL(18, 3) NOT NULL,

    recipe_code_snapshot VARCHAR(50) NOT NULL,
    recipe_name_snapshot VARCHAR(150) NOT NULL,

    planned_for DATETIME(3) NULL,
    notes VARCHAR(500) NULL,

    inventory_movement_id BIGINT UNSIGNED NULL,

    version INT UNSIGNED NOT NULL DEFAULT 1,

    created_by_membership_id BIGINT UNSIGNED NOT NULL,
    updated_by_membership_id BIGINT UNSIGNED NOT NULL,

    started_by_membership_id BIGINT UNSIGNED NULL,
    completed_by_membership_id BIGINT UNSIGNED NULL,
    cancelled_by_membership_id BIGINT UNSIGNED NULL,

    started_at DATETIME(3) NULL,
    completed_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    cancellation_reason VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_orders
        PRIMARY KEY (id),

    CONSTRAINT uq_production_orders_business_order
        UNIQUE (business_id, id),

    CONSTRAINT uq_production_orders_inventory_movement
        UNIQUE (
            business_id,
            inventory_movement_id
        ),

    CONSTRAINT fk_production_orders_recipe
        FOREIGN KEY (
            business_id,
            recipe_id
        )
        REFERENCES production_recipes (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_location
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

    CONSTRAINT fk_production_orders_movement
        FOREIGN KEY (
            business_id,
            inventory_movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_created_by
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

    CONSTRAINT fk_production_orders_updated_by
        FOREIGN KEY (
            business_id,
            updated_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_started_by
        FOREIGN KEY (
            business_id,
            started_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_completed_by
        FOREIGN KEY (
            business_id,
            completed_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_cancelled_by
        FOREIGN KEY (
            business_id,
            cancelled_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_production_orders_status
        CHECK (
            status IN (
                'DRAFT',
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_production_orders_batch_quantity
        CHECK (batch_quantity > 0),

    CONSTRAINT chk_production_orders_version
        CHECK (version > 0),

    CONSTRAINT chk_production_orders_movement_status
        CHECK (
            (
                status = 'COMPLETED'
                AND inventory_movement_id IS NOT NULL
                AND completed_at IS NOT NULL
                AND completed_by_membership_id IS NOT NULL
            )
            OR
            (
                status <> 'COMPLETED'
                AND inventory_movement_id IS NULL
            )
        ),

    CONSTRAINT chk_production_orders_cancellation
        CHECK (
            (
                status = 'CANCELLED'
                AND cancelled_at IS NOT NULL
                AND cancelled_by_membership_id IS NOT NULL
                AND cancellation_reason IS NOT NULL
            )
            OR
            (
                status <> 'CANCELLED'
                AND cancelled_at IS NULL
                AND cancelled_by_membership_id IS NULL
                AND cancellation_reason IS NULL
            )
        ),

    INDEX idx_production_orders_location_status (
        business_id,
        location_id,
        status,
        planned_for
    ),

    INDEX idx_production_orders_recipe (
        business_id,
        recipe_id,
        created_at
    ),

    INDEX idx_production_orders_created (
        business_id,
        created_at
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS production_order_inputs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    production_order_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    item_name_snapshot VARCHAR(150) NOT NULL,
    item_sku_snapshot VARCHAR(50) NULL,
    base_unit_snapshot VARCHAR(30) NOT NULL,

    planned_quantity DECIMAL(18, 3) NOT NULL,
    actual_quantity DECIMAL(18, 3) NULL,

    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_order_inputs
        PRIMARY KEY (id),

    CONSTRAINT uq_production_order_inputs_item
        UNIQUE (
            business_id,
            production_order_id,
            inventory_item_id
        ),

    CONSTRAINT fk_production_order_inputs_order
        FOREIGN KEY (
            business_id,
            production_order_id
        )
        REFERENCES production_orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_production_order_inputs_item
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

    CONSTRAINT chk_production_order_inputs_planned
        CHECK (planned_quantity > 0),

    CONSTRAINT chk_production_order_inputs_actual
        CHECK (
            actual_quantity IS NULL
            OR actual_quantity > 0
        ),

    CONSTRAINT chk_production_order_inputs_unit
        CHECK (
            base_unit_snapshot IN (
                'UNIT',
                'GRAM',
                'KILOGRAM',
                'MILLILITER',
                'LITER',
                'PORTION',
                'PACKAGE'
            )
        ),

    INDEX idx_production_order_inputs_order (
        business_id,
        production_order_id,
        id
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS production_order_outputs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    production_order_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    item_name_snapshot VARCHAR(150) NOT NULL,
    item_sku_snapshot VARCHAR(50) NULL,
    base_unit_snapshot VARCHAR(30) NOT NULL,

    planned_quantity DECIMAL(18, 3) NOT NULL,
    actual_quantity DECIMAL(18, 3) NULL,

    cost_allocation_percentage
        DECIMAL(9, 6) NOT NULL,

    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_order_outputs
        PRIMARY KEY (id),

    CONSTRAINT uq_production_order_outputs_item
        UNIQUE (
            business_id,
            production_order_id,
            inventory_item_id
        ),

    CONSTRAINT fk_production_order_outputs_order
        FOREIGN KEY (
            business_id,
            production_order_id
        )
        REFERENCES production_orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_production_order_outputs_item
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

    CONSTRAINT chk_production_order_outputs_planned
        CHECK (planned_quantity > 0),

    CONSTRAINT chk_production_order_outputs_actual
        CHECK (
            actual_quantity IS NULL
            OR actual_quantity > 0
        ),

    CONSTRAINT chk_production_order_outputs_allocation
        CHECK (
            cost_allocation_percentage > 0
            AND cost_allocation_percentage <= 100
        ),

    CONSTRAINT chk_production_order_outputs_unit
        CHECK (
            base_unit_snapshot IN (
                'UNIT',
                'GRAM',
                'KILOGRAM',
                'MILLILITER',
                'LITER',
                'PORTION',
                'PACKAGE'
            )
        ),

    INDEX idx_production_order_outputs_order (
        business_id,
        production_order_id,
        id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE production_orders;
SHOW CREATE TABLE production_order_inputs;
SHOW CREATE TABLE production_order_outputs;
