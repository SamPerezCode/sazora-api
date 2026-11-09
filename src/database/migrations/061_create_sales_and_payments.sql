-- Migración 061:
-- Crea las ventas financieras, su detalle histórico y sus pagos.
--
-- Una orden es operativa.
-- Una venta es el comprobante financiero definitivo de esa orden.

USE sazora_db;

CREATE TABLE IF NOT EXISTS sales (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    cash_session_id BIGINT UNSIGNED NOT NULL,
    commercial_customer_id BIGINT UNSIGNED NULL,
    sold_by_membership_id BIGINT UNSIGNED NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    currency_code CHAR(3) NOT NULL,

    net_subtotal DECIMAL(18, 6) NOT NULL,
    tax_total DECIMAL(18, 6) NOT NULL,
    discount_total DECIMAL(18, 6) NOT NULL DEFAULT 0.000000,
    tip_total DECIMAL(18, 6) NOT NULL DEFAULT 0.000000,
    total DECIMAL(18, 6) NOT NULL,

    paid_total DECIMAL(18, 6) NOT NULL,
    change_total DECIMAL(18, 6) NOT NULL DEFAULT 0.000000,

    voided_by_membership_id BIGINT UNSIGNED NULL,
    void_reason VARCHAR(500) NULL,
    voided_at DATETIME(3) NULL,

    sold_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_sales
        PRIMARY KEY (id),

    CONSTRAINT uq_sales_business_sale
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_sales_business_order
        UNIQUE (
            business_id,
            order_id
        ),

    CONSTRAINT fk_sales_location
        FOREIGN KEY (
            business_id,
            location_id
        )
        REFERENCES business_locations (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_order
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

    CONSTRAINT fk_sales_cash_session
        FOREIGN KEY (
            business_id,
            cash_session_id
        )
        REFERENCES cash_sessions (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_customer
        FOREIGN KEY (
            business_id,
            commercial_customer_id
        )
        REFERENCES commercial_customers (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_sold_by
        FOREIGN KEY (
            business_id,
            sold_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_voided_by
        FOREIGN KEY (
            business_id,
            voided_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_sales_status
        CHECK (
            status IN (
                'COMPLETED',
                'PARTIALLY_REFUNDED',
                'REFUNDED',
                'VOIDED'
            )
        ),

    CONSTRAINT chk_sales_currency
        CHECK (
            currency_code REGEXP '^[A-Z]{3}$'
        ),

    CONSTRAINT chk_sales_totals
        CHECK (
            net_subtotal >= 0
            AND tax_total >= 0
            AND discount_total >= 0
            AND tip_total >= 0
            AND total >= 0
            AND paid_total >= 0
            AND change_total >= 0
        ),

    CONSTRAINT chk_sales_completed_payment
        CHECK (
            status <> 'COMPLETED'
            OR paid_total = total
        ),

    CONSTRAINT chk_sales_void_data
        CHECK (
            (
                status <> 'VOIDED'
                AND voided_by_membership_id IS NULL
                AND void_reason IS NULL
                AND voided_at IS NULL
            )
            OR
            (
                status = 'VOIDED'
                AND voided_by_membership_id IS NOT NULL
                AND void_reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(void_reason)) > 0
                AND voided_at IS NOT NULL
            )
        ),

    INDEX idx_sales_location_sold (
        business_id,
        location_id,
        sold_at,
        id
    ),

    INDEX idx_sales_session_sold (
        business_id,
        cash_session_id,
        sold_at,
        id
    ),

    INDEX idx_sales_status_sold (
        business_id,
        status,
        sold_at
    ),

    INDEX idx_sales_customer_sold (
        business_id,
        commercial_customer_id,
        sold_at
    ),

    INDEX idx_sales_sold_by (
        business_id,
        sold_by_membership_id,
        sold_at
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sale_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    sale_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,

    product_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NULL,
    preparation_area_id BIGINT UNSIGNED NULL,
    tax_class_id BIGINT UNSIGNED NULL,

    product_name VARCHAR(150) NOT NULL,
    category_name VARCHAR(120) NULL,
    preparation_area_name VARCHAR(120) NULL,

    quantity SMALLINT UNSIGNED NOT NULL,

    unit_price DECIMAL(14, 6) NOT NULL,
    tax_code VARCHAR(50) NULL,
    tax_name VARCHAR(120) NULL,
    tax_type VARCHAR(30) NULL,
    tax_rate DECIMAL(7, 4) NOT NULL,
    price_includes_tax BOOLEAN NOT NULL,

    unit_net_price DECIMAL(14, 6) NOT NULL,
    unit_tax_amount DECIMAL(14, 6) NOT NULL,

    discount_amount DECIMAL(18, 6) NOT NULL DEFAULT 0.000000,
    line_net_total DECIMAL(18, 6) NOT NULL,
    line_tax_total DECIMAL(18, 6) NOT NULL,
    line_total DECIMAL(18, 6) NOT NULL,

    cost_total DECIMAL(24, 6) NULL,
    gross_profit_amount DECIMAL(24, 6) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_sale_items
        PRIMARY KEY (id),

    CONSTRAINT uq_sale_items_business_item
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_sale_items_order_item
        UNIQUE (
            business_id,
            order_item_id
        ),

    CONSTRAINT fk_sale_items_sale
        FOREIGN KEY (
            business_id,
            sale_id
        )
        REFERENCES sales (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_items_order_item
        FOREIGN KEY (
            business_id,
            order_item_id
        )
        REFERENCES order_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_items_product
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

    CONSTRAINT fk_sale_items_category
        FOREIGN KEY (
            business_id,
            category_id
        )
        REFERENCES categories (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_items_preparation_area
        FOREIGN KEY (
            business_id,
            preparation_area_id
        )
        REFERENCES preparation_areas (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_items_tax_class
        FOREIGN KEY (
            business_id,
            tax_class_id
        )
        REFERENCES tax_classes (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_sale_items_product_name
        CHECK (
            CHAR_LENGTH(TRIM(product_name)) > 0
        ),

    CONSTRAINT chk_sale_items_quantity
        CHECK (
            quantity > 0
        ),

    CONSTRAINT chk_sale_items_amounts
        CHECK (
            unit_price >= 0
            AND tax_rate >= 0
            AND tax_rate <= 100
            AND unit_net_price >= 0
            AND unit_tax_amount >= 0
            AND discount_amount >= 0
            AND line_net_total >= 0
            AND line_tax_total >= 0
            AND line_total >= 0
        ),

    CONSTRAINT chk_sale_items_tax_snapshot
        CHECK (
            (
                tax_class_id IS NULL
                AND tax_code IS NULL
                AND tax_name IS NULL
                AND tax_type IS NULL
                AND tax_rate = 0
                AND unit_tax_amount = 0
            )
            OR
            (
                tax_class_id IS NOT NULL
                AND tax_code IS NOT NULL
                AND tax_name IS NOT NULL
                AND tax_type IS NOT NULL
            )
        ),

    CONSTRAINT chk_sale_items_cost_snapshot
        CHECK (
            (
                cost_total IS NULL
                AND gross_profit_amount IS NULL
            )
            OR
            (
                cost_total IS NOT NULL
                AND cost_total >= 0
                AND gross_profit_amount IS NOT NULL
            )
        ),

    INDEX idx_sale_items_sale (
        business_id,
        sale_id,
        id
    ),

    INDEX idx_sale_items_product (
        business_id,
        product_id,
        sale_id
    ),

    INDEX idx_sale_items_category (
        business_id,
        category_id,
        sale_id
    ),

    INDEX idx_sale_items_preparation_area (
        business_id,
        preparation_area_id,
        sale_id
    ),

    INDEX idx_sale_items_tax_class (
        business_id,
        tax_class_id,
        sale_id
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS sale_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    sale_id BIGINT UNSIGNED NOT NULL,
    payment_method_id BIGINT UNSIGNED NOT NULL,
    processed_by_membership_id BIGINT UNSIGNED NOT NULL,
    cash_movement_id BIGINT UNSIGNED NULL,

    payment_method_code VARCHAR(50) NOT NULL,
    payment_method_name VARCHAR(120) NOT NULL,
    payment_type VARCHAR(30) NOT NULL,

    requires_reference BOOLEAN NOT NULL,
    affects_cash BOOLEAN NOT NULL,
    allows_change BOOLEAN NOT NULL,

    amount DECIMAL(18, 6) NOT NULL,
    tendered_amount DECIMAL(18, 6) NOT NULL,
    change_amount DECIMAL(18, 6) NOT NULL DEFAULT 0.000000,

    reference VARCHAR(120) NULL,
    notes VARCHAR(500) NULL,

    paid_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_sale_payments
        PRIMARY KEY (id),

    CONSTRAINT uq_sale_payments_business_payment
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_sale_payments_cash_movement
        UNIQUE (
            business_id,
            cash_movement_id
        ),

    CONSTRAINT fk_sale_payments_sale
        FOREIGN KEY (
            business_id,
            sale_id
        )
        REFERENCES sales (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_payments_method
        FOREIGN KEY (
            business_id,
            payment_method_id
        )
        REFERENCES payment_methods (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_payments_processed_by
        FOREIGN KEY (
            business_id,
            processed_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_sale_payments_cash_movement
        FOREIGN KEY (
            business_id,
            cash_movement_id
        )
        REFERENCES cash_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_sale_payments_type
        CHECK (
            payment_type IN (
                'CASH',
                'CARD',
                'BANK_TRANSFER',
                'DIGITAL_WALLET',
                'VOUCHER',
                'STORE_CREDIT',
                'OTHER'
            )
        ),

    CONSTRAINT chk_sale_payments_amounts
        CHECK (
            amount > 0
            AND tendered_amount >= amount
            AND change_amount >= 0
            AND change_amount = tendered_amount - amount
        ),

    CONSTRAINT chk_sale_payments_non_cash_change
        CHECK (
            payment_type = 'CASH'
            OR (
                tendered_amount = amount
                AND change_amount = 0
                AND allows_change = FALSE
            )
        ),

    CONSTRAINT chk_sale_payments_cash_flags
        CHECK (
            (
                payment_type = 'CASH'
                AND affects_cash = TRUE
            )
            OR
            (
                payment_type <> 'CASH'
                AND affects_cash = FALSE
            )
        ),

    CONSTRAINT chk_sale_payments_reference
        CHECK (
            (
                requires_reference = FALSE
            )
            OR
            (
                reference IS NOT NULL
                AND CHAR_LENGTH(TRIM(reference)) > 0
            )
        ),

    CONSTRAINT chk_sale_payments_notes
        CHECK (
            notes IS NULL
            OR CHAR_LENGTH(TRIM(notes)) > 0
        ),

    INDEX idx_sale_payments_sale (
        business_id,
        sale_id,
        paid_at,
        id
    ),

    INDEX idx_sale_payments_method (
        business_id,
        payment_method_id,
        paid_at
    ),

    INDEX idx_sale_payments_type (
        business_id,
        payment_type,
        paid_at
    ),

    INDEX idx_sale_payments_processed_by (
        business_id,
        processed_by_membership_id,
        paid_at
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE sales;
SHOW CREATE TABLE sale_items;
SHOW CREATE TABLE sale_payments;

SELECT
    TABLE_NAME
FROM information_schema.TABLES
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN (
        'sales',
        'sale_items',
        'sale_payments'
    )
ORDER BY TABLE_NAME;
