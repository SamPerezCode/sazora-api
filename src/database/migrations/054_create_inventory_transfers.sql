USE sazora_db;

-- Permitir movimientos de transferencia.
ALTER TABLE inventory_movements
    DROP CHECK chk_inventory_movements_type;

ALTER TABLE inventory_movements
    ADD CONSTRAINT chk_inventory_movements_type
        CHECK (
            movement_type IN (
                'OPENING',
                'PURCHASE',
                'PRODUCTION',
                'SALE',
                'ADJUSTMENT',
                'WASTE',
                'RETURN',
                'REVERSAL',
                'TRANSFER'
            )
        );

-- Permitir que el costo promedio quede NULL cuando una salida
-- deja el saldo exactamente en cero.
ALTER TABLE inventory_movement_lines
    DROP CHECK chk_inventory_movement_line_cost_data;

ALTER TABLE inventory_movement_lines
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
                AND inventory_value_after IS NOT NULL
                AND (
                    (
                        balance_after = 0
                        AND average_unit_cost_after IS NULL
                        AND inventory_value_after = 0
                    )
                    OR
                    (
                        average_unit_cost_after IS NOT NULL
                    )
                )
            )
        );

CREATE TABLE inventory_transfers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    source_location_id BIGINT UNSIGNED NOT NULL,
    destination_location_id BIGINT UNSIGNED NOT NULL,

    source_movement_id BIGINT UNSIGNED NULL,
    destination_movement_id BIGINT UNSIGNED NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',

    external_reference VARCHAR(120) NULL,
    notes VARCHAR(500) NOT NULL,

    created_by_membership_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at DATETIME(3) NULL,

    CONSTRAINT pk_inventory_transfers
        PRIMARY KEY (id),

    CONSTRAINT uq_inventory_transfers_business_transfer
        UNIQUE (business_id, id),

    CONSTRAINT uq_inventory_transfers_source_movement
        UNIQUE (business_id, source_movement_id),

    CONSTRAINT uq_inventory_transfers_destination_movement
        UNIQUE (business_id, destination_movement_id),

    CONSTRAINT fk_inventory_transfers_source_location
        FOREIGN KEY (
            business_id,
            source_location_id
        )
        REFERENCES business_locations (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_transfers_destination_location
        FOREIGN KEY (
            business_id,
            destination_location_id
        )
        REFERENCES business_locations (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_transfers_source_movement
        FOREIGN KEY (
            business_id,
            source_movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_transfers_destination_movement
        FOREIGN KEY (
            business_id,
            destination_movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_transfers_membership
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

    CONSTRAINT chk_inventory_transfers_locations
        CHECK (
            source_location_id <> destination_location_id
        ),

    CONSTRAINT chk_inventory_transfers_status
        CHECK (
            status IN (
                'PROCESSING',
                'COMPLETED'
            )
        ),

    CONSTRAINT chk_inventory_transfers_completion
        CHECK (
            (
                status = 'PROCESSING'
                AND source_movement_id IS NULL
                AND destination_movement_id IS NULL
                AND completed_at IS NULL
            )
            OR
            (
                status = 'COMPLETED'
                AND source_movement_id IS NOT NULL
                AND destination_movement_id IS NOT NULL
                AND completed_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_inventory_transfers_notes
        CHECK (
            CHAR_LENGTH(TRIM(notes)) >= 3
        ),

    INDEX idx_inventory_transfers_source (
        business_id,
        source_location_id,
        created_at
    ),

    INDEX idx_inventory_transfers_destination (
        business_id,
        destination_location_id,
        created_at
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE inventory_transfers;
