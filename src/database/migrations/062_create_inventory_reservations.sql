-- Migración 062:
-- Crea las reservas de inventario vinculadas a líneas de órdenes abiertas.

USE sazora_db;

ALTER TABLE order_items
    ADD CONSTRAINT uq_order_items_business_order_item_relation
        UNIQUE (
            business_id,
            order_id,
            id
        );

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    business_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    quantity DECIMAL(18, 3) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    expires_at DATETIME(3) NULL,

    reserved_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    consumed_at DATETIME(3) NULL,
    released_at DATETIME(3) NULL,
    release_reason VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_reservations
        PRIMARY KEY (id),

    CONSTRAINT uq_inventory_reservations_business_reservation
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_inventory_reservations_order_item_inventory
        UNIQUE (
            business_id,
            order_item_id,
            inventory_item_id
        ),

    CONSTRAINT fk_inventory_reservations_location
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

    CONSTRAINT fk_inventory_reservations_order
        FOREIGN KEY (
            business_id,
            order_id
        )
        REFERENCES orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_reservations_order_item
        FOREIGN KEY (
            business_id,
            order_id,
            order_item_id
        )
        REFERENCES order_items (
            business_id,
            order_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_inventory_reservations_inventory_item
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

    CONSTRAINT chk_inventory_reservations_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_inventory_reservations_status
        CHECK (
            status IN (
                'ACTIVE',
                'CONSUMED',
                'RELEASED',
                'EXPIRED'
            )
        ),

    CONSTRAINT chk_inventory_reservations_state
        CHECK (
            (
                status = 'ACTIVE'
                AND consumed_at IS NULL
                AND released_at IS NULL
                AND release_reason IS NULL
            )
            OR
            (
                status = 'CONSUMED'
                AND consumed_at IS NOT NULL
                AND released_at IS NULL
                AND release_reason IS NULL
            )
            OR
            (
                status IN ('RELEASED', 'EXPIRED')
                AND consumed_at IS NULL
                AND released_at IS NOT NULL
                AND release_reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(release_reason)) > 0
            )
        ),

    INDEX idx_inventory_reservations_available (
        business_id,
        location_id,
        inventory_item_id,
        status
    ),

    INDEX idx_inventory_reservations_order (
        business_id,
        order_id,
        status
    ),

    INDEX idx_inventory_reservations_order_item (
        business_id,
        order_item_id,
        status
    ),

    INDEX idx_inventory_reservations_expiration (
        status,
        expires_at
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE inventory_reservations;

SELECT
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'inventory_reservations'
ORDER BY CONSTRAINT_NAME;
