-- Migración 031: solicitudes creadas desde el menú público.

USE sazora_db;

CREATE TABLE IF NOT EXISTS public_order_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_code CHAR(36) NOT NULL,
    business_id BIGINT UNSIGNED NOT NULL,
    service_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    customer_email VARCHAR(254) NULL,
    delivery_address VARCHAR(300) NULL,
    notes VARCHAR(500) NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    handled_by_membership_id BIGINT UNSIGNED NULL,
    order_id BIGINT UNSIGNED NULL,
    contacted_at DATETIME(3) NULL,
    accepted_at DATETIME(3) NULL,
    rejected_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    rejection_reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_requests
        PRIMARY KEY (id),

    CONSTRAINT uq_public_order_requests_public_code
        UNIQUE (public_code),

    CONSTRAINT uq_public_order_requests_business_request
        UNIQUE (business_id, id),

    CONSTRAINT fk_public_order_requests_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_requests_handler
        FOREIGN KEY (
            business_id,
            handled_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_requests_order
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

    CONSTRAINT chk_public_order_requests_service_type
        CHECK (service_type IN ('DELIVERY', 'TAKEAWAY')),

    CONSTRAINT chk_public_order_requests_status
        CHECK (
            status IN (
                'NEW',
                'CONTACTED',
                'ACCEPTED',
                'REJECTED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_public_order_requests_customer_name
        CHECK (CHAR_LENGTH(TRIM(customer_name)) > 0),

    CONSTRAINT chk_public_order_requests_customer_phone
        CHECK (CHAR_LENGTH(TRIM(customer_phone)) > 0),

    CONSTRAINT chk_public_order_requests_delivery_address
        CHECK (
            (
                service_type = 'DELIVERY'
                AND delivery_address IS NOT NULL
                AND CHAR_LENGTH(TRIM(delivery_address)) > 0
            )
            OR
            (
                service_type = 'TAKEAWAY'
                AND delivery_address IS NULL
            )
        ),

    CONSTRAINT chk_public_order_requests_subtotal
        CHECK (subtotal >= 0),

    INDEX idx_public_order_requests_business_status_created (
        business_id,
        status,
        created_at
    ),

    INDEX idx_public_order_requests_business_handler (
        business_id,
        handled_by_membership_id,
        status
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS public_order_request_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    public_order_request_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    notes VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_request_items
        PRIMARY KEY (id),

    CONSTRAINT fk_public_order_request_items_request
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

    CONSTRAINT fk_public_order_request_items_product
        FOREIGN KEY (
            business_id,
            product_id
        )
        REFERENCES products (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT uq_public_order_request_items_product
        UNIQUE (
            public_order_request_id,
            product_id
        ),

    CONSTRAINT chk_public_order_request_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_public_order_request_items_price
        CHECK (
            unit_price >= 0
            AND line_total >= 0
        ),

    INDEX idx_public_order_request_items_request (
        business_id,
        public_order_request_id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE public_order_requests;

SHOW CREATE TABLE public_order_request_items;
