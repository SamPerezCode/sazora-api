-- ? Migración 019: creación de los elementos de las comandas.
--
-- ? Cada fila conecta un producto de la orden con la comanda de su área y
-- conserva su estado actual de preparación.

USE sazora_db;

CREATE TABLE IF NOT EXISTS kitchen_ticket_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    kitchen_ticket_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    preparation_area_id BIGINT UNSIGNED NOT NULL,
    preparation_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    last_changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    started_at DATETIME(3) NULL,
    ready_at DATETIME(3) NULL,
    delivered_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_kitchen_ticket_items
        PRIMARY KEY (id),

    CONSTRAINT uq_kitchen_ticket_items_business_item
        UNIQUE (business_id, id),

    CONSTRAINT uq_kitchen_ticket_items_business_order_item
        UNIQUE (business_id, order_item_id),

    CONSTRAINT fk_kitchen_ticket_items_ticket_context
        FOREIGN KEY (
            business_id,
            kitchen_ticket_id,
            order_id,
            preparation_area_id
        )
        REFERENCES kitchen_tickets (
            business_id,
            id,
            order_id,
            preparation_area_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_ticket_items_order_item_context
        FOREIGN KEY (
            business_id,
            order_item_id,
            order_id,
            preparation_area_id
        )
        REFERENCES order_items (
            business_id,
            id,
            order_id,
            preparation_area_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_ticket_items_membership
        FOREIGN KEY (business_id, last_changed_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_kitchen_ticket_items_status
        CHECK (
            preparation_status IN (
                'PENDING',
                'IN_PREPARATION',
                'READY',
                'DELIVERED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_kitchen_ticket_items_status_dates
        CHECK (
            (
                preparation_status = 'PENDING'
                AND started_at IS NULL
                AND ready_at IS NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'IN_PREPARATION'
                AND started_at IS NOT NULL
                AND ready_at IS NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'READY'
                AND started_at IS NOT NULL
                AND ready_at IS NOT NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'DELIVERED'
                AND started_at IS NOT NULL
                AND ready_at IS NOT NULL
                AND delivered_at IS NOT NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'CANCELLED'
                AND delivered_at IS NULL
                AND cancelled_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_kitchen_ticket_items_date_order
        CHECK (
            (ready_at IS NULL OR ready_at >= started_at)
            AND
            (delivered_at IS NULL OR delivered_at >= ready_at)
        ),

    INDEX idx_kitchen_ticket_items_ticket_context (
        business_id,
        kitchen_ticket_id,
        order_id,
        preparation_area_id
    ),

    INDEX idx_kitchen_ticket_items_order_item_context (
        business_id,
        order_item_id,
        order_id,
        preparation_area_id
    ),

    INDEX idx_kitchen_ticket_items_business_membership (
        business_id,
        last_changed_by_membership_id
    ),

    INDEX idx_kitchen_ticket_items_business_ticket_status (
        business_id,
        kitchen_ticket_id,
        preparation_status,
        created_at
    ),

    INDEX idx_kitchen_ticket_items_business_area_status (
        business_id,
        preparation_area_id,
        preparation_status,
        updated_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- kitchen_ticket_id identifica la comanda que recibe el producto.
- order_item_id identifica el elemento original del pedido.
- order_id y preparation_area_id se conservan para que las llaves foráneas
  comprueben todo el contexto operativo, no para duplicar decisiones del negocio.
- Un order_item solo puede aparecer una vez en las comandas. Como cada producto
  tiene una única área en el MVP, no debe enviarse simultáneamente a dos zonas.
- preparation_status admite PENDING, IN_PREPARATION, READY, DELIVERED y CANCELLED.
- started_at, ready_at, delivered_at y cancelled_at conservan los momentos
  principales del proceso de preparación.
- Las restricciones comprueban que las fechas correspondan con el estado actual
  y que READY o DELIVERED no ocurran antes de sus estados anteriores.
- Un producto cancelado puede haber estado pendiente, en preparación o listo,
  pero no puede aparecer simultáneamente como entregado.
- last_changed_by_membership_id identifica quién realizó el último cambio.
- El historial completo de estados se almacenará en
  kitchen_item_status_history; esta tabla conserva únicamente el estado actual.
- El estado general de una comanda se calculará a partir de todos sus elementos.
- Todos los cambios de estado y sus registros históricos deberán ejecutarse en
  una misma transacción.
*/

DESCRIBE kitchen_ticket_items;

SHOW CREATE TABLE kitchen_ticket_items;

SHOW INDEX FROM kitchen_ticket_items;
