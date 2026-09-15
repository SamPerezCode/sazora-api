-- ? Migración 014: creación de la tabla de elementos de una orden.
--
-- ? Cada fila representa un producto agregado a un pedido, con la información
-- comercial y operativa que tenía en ese momento.

USE sazora_db;

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    preparation_area_id BIGINT UNSIGNED NOT NULL,
    added_by_membership_id BIGINT UNSIGNED NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    notes VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    cancelled_by_membership_id BIGINT UNSIGNED NULL,
    cancellation_reason VARCHAR(500) NULL,
    cancelled_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_items
        PRIMARY KEY (id),

    CONSTRAINT uq_order_items_business_order_item
        UNIQUE (business_id, id),

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (business_id, order_id)
        REFERENCES orders (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (business_id, product_id)
        REFERENCES products (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_preparation_area
        FOREIGN KEY (business_id, preparation_area_id)
        REFERENCES preparation_areas (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_added_by_membership
        FOREIGN KEY (business_id, added_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_cancelled_by_membership
        FOREIGN KEY (business_id, cancelled_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_items_product_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(product_name)) > 0),

    CONSTRAINT chk_order_items_quantity_positive
        CHECK (quantity > 0),

    CONSTRAINT chk_order_items_unit_price_not_negative
        CHECK (unit_price >= 0),

    CONSTRAINT chk_order_items_notes_not_blank
        CHECK (notes IS NULL OR CHAR_LENGTH(TRIM(notes)) > 0),

    CONSTRAINT chk_order_items_status
        CHECK (status IN ('ACTIVE', 'CANCELLED')),

    CONSTRAINT chk_order_items_cancellation_data
        CHECK (
            (
                status = 'ACTIVE'
                AND cancelled_by_membership_id IS NULL
                AND cancellation_reason IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                status = 'CANCELLED'
                AND cancelled_by_membership_id IS NOT NULL
                AND cancellation_reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(cancellation_reason)) > 0
                AND cancelled_at IS NOT NULL
            )
        ),

    INDEX idx_order_items_business_order_status_created (
        business_id,
        order_id,
        status,
        created_at
    ),

    INDEX idx_order_items_business_area_status (
        business_id,
        preparation_area_id,
        status
    ),

    INDEX idx_order_items_business_product (
        business_id,
        product_id
    ),

    INDEX idx_order_items_business_added_by (
        business_id,
        added_by_membership_id
    ),

    INDEX idx_order_items_business_cancelled_by (
        business_id,
        cancelled_by_membership_id
    )
) ENGINE = InnoDB;

/*
Explicación:

- order_id identifica el pedido al cual pertenece el elemento.
- product_id conserva la relación con el producto original del catálogo.
- product_name copia el nombre vigente cuando se agrega el producto. Así, un
  cambio posterior en el catálogo no altera pedidos, recibos ni comandas.
- preparation_area_id copia la ruta de preparación vigente en ese momento.
  Si el producto cambia de área después, el pedido existente conserva su ruta.
- unit_price copia products.current_price desde el backend. El frontend nunca
  debe decidir ni enviar como confiable el precio definitivo.
- quantity debe ser mayor que cero. Llevar una cantidad a cero se tratará como
  una cancelación, no como una cantidad válida.
- Los elementos ACTIVE participan en los totales; los CANCELLED se excluyen.
- Un elemento cancelado no se elimina después de confirmar la orden. Conserva
  quién lo canceló, cuándo ocurrió y la razón obligatoria.
- Mientras la orden permanezca en OPEN, el backend podrá eliminar físicamente
  un elemento que todavía no haya sido enviado a preparación.
- added_by_membership_id y cancelled_by_membership_id permiten auditar las
  acciones realizadas por el personal.
- Todas las llaves foráneas compuestas impiden mezclar información entre
  negocios distintos.
- Una adición posterior a la confirmación se guardará como una nueva fila, aun
  cuando ya exista otra fila del mismo producto dentro del pedido.
- Los cambios de cantidad, notas y cancelación se registrarán posteriormente
  en order_item_changes.
*/

DESCRIBE order_items;

SHOW CREATE TABLE order_items;

SHOW INDEX FROM order_items;
