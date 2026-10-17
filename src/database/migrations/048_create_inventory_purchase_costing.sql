USE sazora_db;

-- =========================================================
-- 1. Presentaciones utilizadas para comprar inventario
-- =========================================================

CREATE TABLE inventory_purchase_presentations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(120) NOT NULL,

    -- Cantidad de unidades base contenidas en una presentación.
    --
    -- Ejemplos:
    -- Bulto de harina de 50 kg, artículo medido en GRAM:
    -- conversion_factor = 50000
    --
    -- Caja de 24 botellas, artículo medido en UNIT:
    -- conversion_factor = 24
    conversion_factor DECIMAL(18, 6) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_purchase_presentations
        PRIMARY KEY (id),

    CONSTRAINT uq_inventory_purchase_presentations_business_id
        UNIQUE (business_id, id),

    CONSTRAINT uq_inventory_purchase_presentations_name
        UNIQUE (
            business_id,
            inventory_item_id,
            name
        ),

    CONSTRAINT fk_inventory_purchase_presentations_item
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

    CONSTRAINT chk_inventory_purchase_conversion_factor
        CHECK (conversion_factor > 0),

    CONSTRAINT chk_inventory_purchase_presentation_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_inventory_purchase_presentations_item (
        business_id,
        inventory_item_id,
        is_active
    )
) ENGINE = InnoDB;

-- =========================================================
-- 2. Referencia externa de la compra
-- =========================================================

ALTER TABLE inventory_movements
    ADD COLUMN external_reference VARCHAR(120) NULL
        AFTER source_id;

-- =========================================================
-- 3. Guardar la presentación original usada en la compra
-- =========================================================

ALTER TABLE inventory_movement_lines
    ADD COLUMN purchase_presentation_id BIGINT UNSIGNED NULL
        AFTER inventory_item_id,

    ADD COLUMN purchase_presentation_name VARCHAR(120) NULL
        AFTER purchase_presentation_id,

    ADD COLUMN purchased_quantity DECIMAL(18, 3) NULL
        AFTER purchase_presentation_name,

    ADD COLUMN purchase_conversion_factor DECIMAL(18, 6) NULL
        AFTER purchased_quantity,

    ADD CONSTRAINT fk_inventory_movement_lines_presentation
        FOREIGN KEY (
            business_id,
            purchase_presentation_id
        )
        REFERENCES inventory_purchase_presentations (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    ADD CONSTRAINT chk_inventory_movement_purchase_snapshot
        CHECK (
            (
                purchase_presentation_id IS NULL
                AND purchase_presentation_name IS NULL
                AND purchased_quantity IS NULL
                AND purchase_conversion_factor IS NULL
            )
            OR
            (
                purchase_presentation_id IS NOT NULL
                AND purchase_presentation_name IS NOT NULL
                AND purchased_quantity > 0
                AND purchase_conversion_factor > 0
            )
        );

SHOW CREATE TABLE inventory_purchase_presentations;
SHOW CREATE TABLE inventory_movements;
SHOW CREATE TABLE inventory_movement_lines;
