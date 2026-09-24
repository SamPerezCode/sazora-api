-- Migración 034: núcleo de inventario y libro de movimientos.

USE sazora_db;

CREATE TABLE IF NOT EXISTS inventory_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    sku VARCHAR(50) NULL,
    name VARCHAR(150) NOT NULL,
    item_type VARCHAR(30) NOT NULL,
    base_unit VARCHAR(30) NOT NULL,
    current_stock DECIMAL(18, 3) NOT NULL DEFAULT 0.000,
    minimum_stock DECIMAL(18, 3) NOT NULL DEFAULT 0.000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_items
        PRIMARY KEY (id),

    CONSTRAINT uq_inventory_items_business_item
        UNIQUE (business_id, id),

    CONSTRAINT uq_inventory_items_business_sku
        UNIQUE (business_id, sku),

    CONSTRAINT fk_inventory_items_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_items_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_inventory_items_sku
        CHECK (
            sku IS NULL
            OR CHAR_LENGTH(TRIM(sku)) > 0
        ),

    CONSTRAINT chk_inventory_items_type
        CHECK (
            item_type IN (
                'RAW_MATERIAL',
                'SEMI_FINISHED',
                'FINISHED_GOOD',
                'RESALE_GOOD'
            )
        ),

    CONSTRAINT chk_inventory_items_unit
        CHECK (
            base_unit IN (
                'UNIT',
                'GRAM',
                'KILOGRAM',
                'MILLILITER',
                'LITER',
                'PORTION',
                'PACKAGE'
            )
        ),

    CONSTRAINT chk_inventory_items_stock
        CHECK (
            current_stock >= 0
            AND minimum_stock >= 0
        ),

    INDEX idx_inventory_items_business_active_name (
        business_id,
        is_active,
        name
    ),

    INDEX idx_inventory_items_business_type (
        business_id,
        item_type,
        is_active
    ),

    INDEX idx_inventory_items_business_stock (
        business_id,
        current_stock,
        minimum_stock
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    movement_type VARCHAR(30) NOT NULL,
    source_type VARCHAR(30) NULL,
    source_id VARCHAR(100) NULL,
    notes VARCHAR(500) NULL,
    created_by_membership_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_movements
        PRIMARY KEY (id),

    CONSTRAINT uq_inventory_movements_business_movement
        UNIQUE (business_id, id),

    CONSTRAINT uq_inventory_movements_source
        UNIQUE (
            business_id,
            source_type,
            source_id
        ),

    CONSTRAINT fk_inventory_movements_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_movements_membership
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

    CONSTRAINT chk_inventory_movements_type
        CHECK (
            movement_type IN (
                'OPENING',
                'PURCHASE',
                'PRODUCTION',
                'SALE',
                'ADJUSTMENT',
                'WASTE',
                'RETURN',
                'REVERSAL'
            )
        ),

    CONSTRAINT chk_inventory_movements_source
        CHECK (
            (
                source_type IS NULL
                AND source_id IS NULL
            )
            OR
            (
                source_type IS NOT NULL
                AND source_id IS NOT NULL
            )
        ),

    INDEX idx_inventory_movements_business_created (
        business_id,
        created_at
    ),

    INDEX idx_inventory_movements_business_type_created (
        business_id,
        movement_type,
        created_at
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS inventory_movement_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    movement_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,
    direction VARCHAR(10) NOT NULL,
    quantity DECIMAL(18, 3) NOT NULL,
    balance_before DECIMAL(18, 3) NOT NULL,
    balance_after DECIMAL(18, 3) NOT NULL,
    notes VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_movement_lines
        PRIMARY KEY (id),

    CONSTRAINT fk_inventory_movement_lines_movement
        FOREIGN KEY (
            business_id,
            movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_movement_lines_item
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

    CONSTRAINT chk_inventory_movement_lines_direction
        CHECK (direction IN ('IN', 'OUT')),

    CONSTRAINT chk_inventory_movement_lines_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_inventory_movement_lines_balances
        CHECK (
            balance_before >= 0
            AND balance_after >= 0
        ),

    INDEX idx_inventory_movement_lines_item_created (
        business_id,
        inventory_item_id,
        created_at
    ),

    INDEX idx_inventory_movement_lines_movement (
        business_id,
        movement_id,
        id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE inventory_items;
SHOW CREATE TABLE inventory_movements;
SHOW CREATE TABLE inventory_movement_lines;
