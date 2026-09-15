-- ? Migración 016: creación del historial de estados de las órdenes.
--
-- ? Cada fila registra una transición de estado. Este historial es acumulativo
-- y sus registros no deben editarse ni eliminarse.

USE sazora_db;

CREATE TABLE IF NOT EXISTS order_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_status_history
        PRIMARY KEY (id),

    CONSTRAINT fk_order_status_history_order
        FOREIGN KEY (business_id, order_id)
        REFERENCES orders (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_status_history_membership
        FOREIGN KEY (business_id, changed_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_status_history_previous_status
        CHECK (
            previous_status IS NULL
            OR previous_status IN (
                'OPEN',
                'CONFIRMED',
                'DELIVERED',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_order_status_history_new_status
        CHECK (
            new_status IN (
                'OPEN',
                'CONFIRMED',
                'DELIVERED',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_order_status_history_transition
        CHECK (
            (previous_status IS NULL AND new_status = 'OPEN')
            OR
            (
                previous_status IS NOT NULL
                AND previous_status <> new_status
            )
        ),

    CONSTRAINT chk_order_status_history_reason
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

    INDEX idx_order_status_history_business_order_created (
        business_id,
        order_id,
        created_at
    ),

    INDEX idx_order_status_history_business_status_created (
        business_id,
        new_status,
        created_at
    ),

    INDEX idx_order_status_history_business_member_created (
        business_id,
        changed_by_membership_id,
        created_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- order_id identifica la orden cuyo estado cambió.
- changed_by_membership_id identifica al empleado responsable del cambio.
- previous_status conserva el estado anterior y es NULL únicamente en el evento
  inicial que registra la creación de la orden en OPEN.
- new_status conserva el estado al cual pasó la orden.
- Los estados admitidos coinciden con orders: OPEN, CONFIRMED, DELIVERED,
  CLOSED y CANCELLED.
- Una cancelación exige una razón. Para otros cambios, la razón es opcional,
  pero no puede contener solamente espacios.
- La restricción de transición impide registrar un cambio hacia el mismo estado.
- Las reglas específicas de transición, como OPEN -> CONFIRMED o
  DELIVERED -> CONFIRMED después de una adición, se validarán en el backend.
  Esto permite evolucionar el flujo sin tener que alterar esta tabla.
- La modificación de orders y la inserción del historial deberán realizarse
  dentro de la misma transacción.
- La tabla no tiene updated_at porque los eventos históricos son inmutables.
- Los índices facilitan reconstruir la historia de una orden y consultar cambios
  por estado o por empleado.
*/

DESCRIBE order_status_history;

SHOW CREATE TABLE order_status_history;

SHOW INDEX FROM order_status_history;
