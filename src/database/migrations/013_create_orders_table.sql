-- ? Migración 013: creación de la tabla de órdenes.
--
-- ? Una orden representa el pedido completo y puede originarse en una mesa
-- o directamente en el mostrador.

USE sazora_db;

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    restaurant_table_id BIGINT UNSIGNED NULL,
    opened_by_membership_id BIGINT UNSIGNED NOT NULL,
    service_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    customer_count SMALLINT UNSIGNED NULL,
    notes VARCHAR(500) NULL,
    confirmed_at DATETIME(3) NULL,
    delivered_at DATETIME(3) NULL,
    closed_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_orders
        PRIMARY KEY (id),

    CONSTRAINT uq_orders_business_order
        UNIQUE (business_id, id),

    CONSTRAINT fk_orders_table
        FOREIGN KEY (business_id, restaurant_table_id)
        REFERENCES restaurant_tables (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_orders_opened_by_membership
        FOREIGN KEY (business_id, opened_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_orders_service_type
        CHECK (service_type IN ('TABLE', 'COUNTER')),

    CONSTRAINT chk_orders_table_matches_service
        CHECK (
            (service_type = 'TABLE' AND restaurant_table_id IS NOT NULL)
            OR
            (service_type = 'COUNTER' AND restaurant_table_id IS NULL)
        ),

    CONSTRAINT chk_orders_status
        CHECK (
            status IN (
                'OPEN',
                'CONFIRMED',
                'DELIVERED',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_orders_customer_count_positive
        CHECK (customer_count IS NULL OR customer_count > 0),

    CONSTRAINT chk_orders_notes_not_blank
        CHECK (notes IS NULL OR CHAR_LENGTH(TRIM(notes)) > 0),

    INDEX idx_orders_business_status_created (
        business_id,
        status,
        created_at
    ),

    INDEX idx_orders_business_table_status (
        business_id,
        restaurant_table_id,
        status
    ),

    INDEX idx_orders_business_membership_created (
        business_id,
        opened_by_membership_id,
        created_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- id identifica la orden y será también su número inicial visible en el MVP.
- business_id identifica el negocio propietario de la orden.
- opened_by_membership_id identifica al empleado que abrió el pedido dentro
  de ese negocio.
- service_type diferencia pedidos atendidos en mesa de pedidos de mostrador.
- restaurant_table_id es obligatorio para TABLE y debe ser NULL para COUNTER.
- La llave foránea compuesta impide asociar una mesa de otro negocio.
- status representa el estado general confirmado para el MVP: OPEN,
  CONFIRMED, DELIVERED, CLOSED o CANCELLED.
- Las fechas de estado facilitan consultas operativas e informes. El historial
  detallado de transiciones se almacenará en order_status_history.
- customer_count es opcional y, cuando se suministra, debe ser mayor que cero.
- No se almacenan totales todavía. Se calcularán con los elementos activos y
  sus precios históricos para evitar inconsistencias durante esta etapa.
- La ocupación de una mesa se obtendrá buscando órdenes activas asociadas con
  ella. Por eso restaurant_tables no necesita un campo is_occupied.
- Los índices facilitan consultar órdenes por estado, mesa y empleado.
*/

DESCRIBE orders;

SHOW CREATE TABLE orders;

SHOW INDEX FROM orders;
