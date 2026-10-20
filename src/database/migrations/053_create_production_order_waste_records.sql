USE sazora_db;

-- =========================================================
-- Migración 053
-- Desperdicios explícitos asociados a órdenes de producción
-- =========================================================

CREATE TABLE IF NOT EXISTS production_order_waste_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    production_order_id BIGINT UNSIGNED NOT NULL,
    inventory_movement_id BIGINT UNSIGNED NOT NULL,

    reason VARCHAR(500) NOT NULL,

    recorded_by_membership_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_order_waste_records
        PRIMARY KEY (id),

    CONSTRAINT uq_production_order_waste_business_record
        UNIQUE (
            business_id,
            id
        ),

    /*
     * Un movimiento de inventario solo puede representar
     * un registro de desperdicio de producción.
     */
    CONSTRAINT uq_production_order_waste_movement
        UNIQUE (
            business_id,
            inventory_movement_id
        ),

    CONSTRAINT fk_production_order_waste_order
        FOREIGN KEY (
            business_id,
            production_order_id
        )
        REFERENCES production_orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_order_waste_movement
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

    CONSTRAINT fk_production_order_waste_recorded_by
        FOREIGN KEY (
            business_id,
            recorded_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_production_order_waste_reason
        CHECK (
            CHAR_LENGTH(TRIM(reason)) >= 3
        ),

    INDEX idx_production_order_waste_order (
        business_id,
        production_order_id,
        created_at
    ),

    INDEX idx_production_order_waste_responsible (
        business_id,
        recorded_by_membership_id,
        created_at
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE production_order_waste_records;
