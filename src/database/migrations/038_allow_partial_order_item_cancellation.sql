USE sazora_db;

ALTER TABLE order_item_changes
    DROP CHECK chk_order_item_changes_event_data;

ALTER TABLE order_item_changes
    ADD CONSTRAINT chk_order_item_changes_event_data
        CHECK (
            (
                change_type = 'ADDED'
                AND previous_quantity IS NULL
                AND new_quantity IS NOT NULL
                AND new_quantity > 0
                AND previous_notes IS NULL
                AND reason IS NULL
            )
            OR
            (
                change_type = 'QUANTITY_INCREASED'
                AND previous_quantity IS NOT NULL
                AND new_quantity IS NOT NULL
                AND previous_quantity > 0
                AND new_quantity > previous_quantity
                AND previous_notes IS NULL
                AND new_notes IS NULL
                AND reason IS NULL
            )
            OR
            (
                change_type = 'QUANTITY_DECREASED'
                AND previous_quantity IS NOT NULL
                AND new_quantity IS NOT NULL
                AND new_quantity > 0
                AND new_quantity < previous_quantity
                AND previous_notes IS NULL
                AND new_notes IS NULL
            )
            OR
            (
                change_type = 'NOTES_CHANGED'
                AND previous_quantity IS NULL
                AND new_quantity IS NULL
                AND NOT (previous_notes <=> new_notes)
                AND reason IS NULL
            )
            OR
            (
                change_type = 'CANCELLED'
                AND previous_quantity IS NOT NULL
                AND previous_quantity > 0
                AND new_quantity IS NULL
                AND previous_notes IS NULL
                AND new_notes IS NULL
                AND reason IS NOT NULL
            )
        );
