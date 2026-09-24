-- Migración 032: gestión de domicilios de solicitudes públicas.

USE sazora_db;

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'DELIVERY_DRIVER',
    'Domiciliario',
    'Recibe, transporta y entrega pedidos a domicilio.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'DELIVERY_DRIVER'
);

CREATE TABLE IF NOT EXISTS public_order_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    public_order_request_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    assigned_driver_membership_id BIGINT UNSIGNED NULL,
    assigned_by_membership_id BIGINT UNSIGNED NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    assigned_at DATETIME(3) NULL,
    picked_up_at DATETIME(3) NULL,
    out_for_delivery_at DATETIME(3) NULL,
    delivered_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_deliveries
        PRIMARY KEY (id),

    CONSTRAINT uq_public_order_deliveries_business_delivery
        UNIQUE (business_id, id),

    CONSTRAINT uq_public_order_deliveries_request
        UNIQUE (public_order_request_id),

    CONSTRAINT uq_public_order_deliveries_order
        UNIQUE (order_id),

    CONSTRAINT fk_public_order_deliveries_request
        FOREIGN KEY (
            business_id,
            public_order_request_id
        )
        REFERENCES public_order_requests (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_deliveries_order
        FOREIGN KEY (
            business_id,
            order_id
        )
        REFERENCES orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_deliveries_driver
        FOREIGN KEY (
            business_id,
            assigned_driver_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_deliveries_assigner
        FOREIGN KEY (
            business_id,
            assigned_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_public_order_deliveries_status
        CHECK (
            status IN (
                'PENDING_ASSIGNMENT',
                'ASSIGNED',
                'PICKED_UP',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'CANCELLED'
            )
        ),

    INDEX idx_public_order_deliveries_business_status (
        business_id,
        status,
        created_at
    ),

    INDEX idx_public_order_deliveries_driver_status (
        business_id,
        assigned_driver_membership_id,
        status,
        created_at
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS public_order_delivery_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    delivery_id BIGINT UNSIGNED NOT NULL,
    changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_delivery_status_history
        PRIMARY KEY (id),

    CONSTRAINT fk_public_order_delivery_history_delivery
        FOREIGN KEY (
            business_id,
            delivery_id
        )
        REFERENCES public_order_deliveries (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_delivery_history_membership
        FOREIGN KEY (
            business_id,
            changed_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_public_order_delivery_history_delivery (
        business_id,
        delivery_id,
        created_at
    )
) ENGINE = InnoDB;

-- Recupera solicitudes DELIVERY aceptadas antes de esta migración.

INSERT INTO public_order_deliveries (
    business_id,
    public_order_request_id,
    order_id,
    status,
    delivered_at
)
SELECT
    por.business_id,
    por.id,
    por.order_id,
    CASE
        WHEN o.status IN ('DELIVERED', 'CLOSED')
            THEN 'DELIVERED'
        ELSE 'PENDING_ASSIGNMENT'
    END,
    CASE
        WHEN o.status IN ('DELIVERED', 'CLOSED')
            THEN o.delivered_at
        ELSE NULL
    END
FROM public_order_requests AS por
INNER JOIN orders AS o
    ON o.business_id = por.business_id
    AND o.id = por.order_id
WHERE
    por.service_type = 'DELIVERY'
    AND por.status = 'ACCEPTED'
    AND por.order_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM public_order_deliveries AS existing_delivery
        WHERE existing_delivery.public_order_request_id = por.id
    );

SELECT
    id,
    code,
    name
FROM roles
WHERE code = 'DELIVERY_DRIVER';

SHOW CREATE TABLE public_order_deliveries;
SHOW CREATE TABLE public_order_delivery_status_history;
