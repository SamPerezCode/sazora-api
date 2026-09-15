-- ? Migración 020: creación del historial de preparación de las comandas.
--
-- ? Cada fila registra una transición de estado de un producto enviado a un
-- área de preparación. Los eventos son inmutables.

USE sazora_db;

CREATE TABLE IF NOT EXISTS kitchen_item_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    kitchen_ticket_item_id BIGINT UNSIGNED NOT NULL,
    changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_kitchen_item_status_history
        PRIMARY KEY (id),

    CONSTRAINT fk_kitchen_item_status_history_item
        FOREIGN KEY (business_id, kitchen_ticket_item_id)
        REFERENCES kitchen_ticket_items (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_item_status_history_membership
        FOREIGN KEY (business_id, changed_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_kitchen_item_status_history_previous_status
        CHECK (
            previous_status IS NULL
            OR previous_status IN (
                'PENDING',
                'IN_PREPARATION',
                'READY',
                'DELIVERED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_kitchen_item_status_history_new_status
        CHECK (
            new_status IN (
                'PENDING',
                'IN_PREPARATION',
                'READY',
                'DELIVERED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_kitchen_item_status_history_transition
        CHECK (
            (previous_status IS NULL AND new_status = 'PENDING')
            OR
            (
                previous_status IS NOT NULL
                AND previous_status <> new_status
            )
        ),

    CONSTRAINT chk_kitchen_item_status_history_reason
        CHECK (
            (
                new_status = 'CANCELLED'
                AND reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(reason)) > 0
            )
            OR
            (
                new_status <> 'CANCELLED'
                AND (reason IS NULL OR CHAR_LENGTH(TRIM(reason)) > 0)
            )
        ),

    INDEX idx_kitchen_item_history_business_item_created (
        business_id,
        kitchen_ticket_item_id,
        created_at
    ),

    INDEX idx_kitchen_item_history_business_status_created (
        business_id,
        new_status,
        created_at
    ),

    INDEX idx_kitchen_item_history_business_member_created (
        business_id,
        changed_by_membership_id,
        created_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- kitchen_ticket_item_id identifica el producto de la comanda cuyo estado cambió.
- changed_by_membership_id identifica al empleado que realizó la transición.
- previous_status es NULL únicamente en el evento inicial que registra PENDING.
- new_status conserva el nuevo estado de preparación.
- Los estados coinciden con kitchen_ticket_items: PENDING, IN_PREPARATION,
  READY, DELIVERED y CANCELLED.
- Una cancelación exige una razón. Para las demás transiciones es opcional, pero
  nunca puede contener solamente espacios.
- La base de datos impide registrar una transición hacia el mismo estado.
- Las transiciones específicas permitidas, como PENDING -> IN_PREPARATION o
  READY -> DELIVERED, se validarán en el backend.
- kitchen_ticket_items y su evento histórico deberán actualizarse dentro de una
  misma transacción.
- Esta tabla no tiene updated_at porque un evento histórico nunca debe editarse.
- El historial permitirá medir tiempos de preparación y determinar quién realizó
  cada cambio sin depender únicamente del estado actual.
*/

DESCRIBE kitchen_item_status_history;

SHOW CREATE TABLE kitchen_item_status_history;

SHOW INDEX FROM kitchen_item_status_history;
