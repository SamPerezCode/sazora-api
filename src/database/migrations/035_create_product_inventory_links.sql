-- Migración 035: relación entre productos de venta e inventario.

USE sazora_db;

CREATE TABLE IF NOT EXISTS product_inventory_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,
    quantity_per_product DECIMAL(18, 3) NOT NULL,
    auto_deduct BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_product_inventory_links
        PRIMARY KEY (id),

    CONSTRAINT uq_product_inventory_links_business_link
        UNIQUE (business_id, id),

    CONSTRAINT uq_product_inventory_links_product_item
        UNIQUE (
            business_id,
            product_id,
            inventory_item_id
        ),

    CONSTRAINT fk_product_inventory_links_product
        FOREIGN KEY (
            business_id,
            product_id
        )
        REFERENCES products (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_inventory_links_item
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

    CONSTRAINT chk_product_inventory_links_quantity
        CHECK (quantity_per_product > 0),

    INDEX idx_product_inventory_links_product (
        business_id,
        product_id,
        is_active
    ),

    INDEX idx_product_inventory_links_inventory_item (
        business_id,
        inventory_item_id,
        is_active
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE product_inventory_links;
