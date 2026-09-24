-- Migración 037:
-- Productos combo y sus productos componentes.

USE sazora_db;

CREATE TABLE IF NOT EXISTS product_combo_components (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    combo_product_id BIGINT UNSIGNED NOT NULL,
    component_product_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(18, 3) NOT NULL,
    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_product_combo_components
        PRIMARY KEY (id),

    CONSTRAINT uq_product_combo_component
        UNIQUE (
            business_id,
            combo_product_id,
            component_product_id
        ),

    CONSTRAINT fk_combo_components_combo_product
        FOREIGN KEY (
            business_id,
            combo_product_id
        )
        REFERENCES products (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_combo_components_component_product
        FOREIGN KEY (
            business_id,
            component_product_id
        )
        REFERENCES products (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_combo_components_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_combo_components_different_products
        CHECK (
            combo_product_id <> component_product_id
        ),

    INDEX idx_combo_components_combo (
        business_id,
        combo_product_id
    ),

    INDEX idx_combo_components_component (
        business_id,
        component_product_id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE product_combo_components;
