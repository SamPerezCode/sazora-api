USE sazora_db;

-- =========================================================
-- Migración 051
-- Recetas o fórmulas de producción
-- =========================================================

CREATE TABLE IF NOT EXISTS production_recipes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    notes VARCHAR(500) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by_membership_id BIGINT UNSIGNED NOT NULL,
    updated_by_membership_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_recipes
        PRIMARY KEY (id),

    CONSTRAINT uq_production_recipes_business_recipe
        UNIQUE (business_id, id),

    CONSTRAINT uq_production_recipes_business_code
        UNIQUE (business_id, code),

    CONSTRAINT fk_production_recipes_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_recipes_created_by
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

    CONSTRAINT fk_production_recipes_updated_by
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

    CONSTRAINT chk_production_recipes_code
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_production_recipes_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_production_recipes_business_active (
        business_id,
        is_active,
        name
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS production_recipe_inputs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    recipe_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    quantity DECIMAL(18, 3) NOT NULL,
    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_recipe_inputs
        PRIMARY KEY (id),

    CONSTRAINT uq_production_recipe_inputs_item
        UNIQUE (
            business_id,
            recipe_id,
            inventory_item_id
        ),

    CONSTRAINT fk_production_recipe_inputs_recipe
        FOREIGN KEY (
            business_id,
            recipe_id
        )
        REFERENCES production_recipes (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_production_recipe_inputs_item
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

    CONSTRAINT chk_production_recipe_inputs_quantity
        CHECK (quantity > 0),

    INDEX idx_production_recipe_inputs_recipe (
        business_id,
        recipe_id,
        id
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS production_recipe_outputs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    recipe_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    quantity DECIMAL(18, 3) NOT NULL,

    cost_allocation_percentage
        DECIMAL(9, 6) NOT NULL,

    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_recipe_outputs
        PRIMARY KEY (id),

    CONSTRAINT uq_production_recipe_outputs_item
        UNIQUE (
            business_id,
            recipe_id,
            inventory_item_id
        ),

    CONSTRAINT fk_production_recipe_outputs_recipe
        FOREIGN KEY (
            business_id,
            recipe_id
        )
        REFERENCES production_recipes (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_production_recipe_outputs_item
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

    CONSTRAINT chk_production_recipe_outputs_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_production_recipe_output_allocation
        CHECK (
            cost_allocation_percentage > 0
            AND cost_allocation_percentage <= 100
        ),

    INDEX idx_production_recipe_outputs_recipe (
        business_id,
        recipe_id,
        id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE production_recipes;
SHOW CREATE TABLE production_recipe_inputs;
SHOW CREATE TABLE production_recipe_outputs;
