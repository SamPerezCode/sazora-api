-- ? Migración 015: creación del historial de cambios de elementos de órdenes.
--
-- ? Cada fila registra un evento ocurrido sobre un producto del pedido.
-- Este historial es acumulativo: sus registros no deben editarse ni eliminarse.

USE sazora_db;

CREATE TABLE IF NOT EXISTS order_item_changes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    change_type VARCHAR(30) NOT NULL,
    previous_quantity SMALLINT UNSIGNED NULL,
    new_quantity SMALLINT UNSIGNED NULL,
    previous_notes VARCHAR(500) NULL,
    new_notes VARCHAR(500) NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_item_changes
        PRIMARY KEY (id),

    CONSTRAINT fk_order_item_changes_order_item
        FOREIGN KEY (business_id, order_item_id)
        REFERENCES order_items (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_item_changes_membership
        FOREIGN KEY (business_id, changed_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_item_changes_type
        CHECK (
            change_type IN (
                'ADDED',
                'QUANTITY_INCREASED',
                'QUANTITY_DECREASED',
                'NOTES_CHANGED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_order_item_changes_notes_not_blank
        CHECK (
            (previous_notes IS NULL OR CHAR_LENGTH(TRIM(previous_notes)) > 0)
            AND
            (new_notes IS NULL OR CHAR_LENGTH(TRIM(new_notes)) > 0)
        ),

    CONSTRAINT chk_order_item_changes_reason_not_blank
        CHECK (reason IS NULL OR CHAR_LENGTH(TRIM(reason)) > 0),

    CONSTRAINT chk_order_item_changes_event_data
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
                AND reason IS NULL
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
        ),

    INDEX idx_order_item_changes_business_item_created (
        business_id,
        order_item_id,
        created_at
    ),

    INDEX idx_order_item_changes_business_member_created (
        business_id,
        changed_by_membership_id,
        created_at
    ),

    INDEX idx_order_item_changes_business_type_created (
        business_id,
        change_type,
        created_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- order_item_id identifica el producto del pedido que fue modificado.
- changed_by_membership_id identifica al empleado que realizó la acción.
- change_type admite ADDED, QUANTITY_INCREASED, QUANTITY_DECREASED,
  NOTES_CHANGED y CANCELLED.
- previous_quantity y new_quantity permiten reconstruir cambios de cantidad.
- previous_notes y new_notes permiten reconstruir cambios de observaciones.
- reason es obligatorio únicamente para CANCELLED.
- ADDED conserva la cantidad inicial y, cuando existe, la observación inicial.
- CANCELLED conserva la cantidad que fue cancelada y su razón.
- Las restricciones validan que cada tipo de evento contenga únicamente los
  datos que le corresponden.
- El operador <=> compara valores de forma segura cuando alguno es NULL. Así se
  puede registrar tanto la creación como la eliminación de una observación.
- La tabla no tiene updated_at porque un evento histórico nunca debe editarse.
- Las modificaciones del elemento y la inserción de su evento deberán ocurrir
  dentro de una misma transacción para que ambos cambios sean inseparables.
- Esta tabla no representa comandas nuevas. Los eventos determinarán qué áreas
  deben recibir una versión actualizada o una reimpresión de la misma comanda.
*/

DESCRIBE order_item_changes;

SHOW CREATE TABLE order_item_changes;

SHOW INDEX FROM order_item_changes;
