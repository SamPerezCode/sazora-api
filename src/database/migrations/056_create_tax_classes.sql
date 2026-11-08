-- Migración 056:
-- Crea las clases tributarias configurables, sus tarifas por vigencia
-- y permite asociarlas con los productos.

USE sazora_db;

CREATE TABLE IF NOT EXISTS tax_classes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    tax_type VARCHAR(30) NOT NULL,
    description VARCHAR(255) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_tax_classes
        PRIMARY KEY (id),

    CONSTRAINT uq_tax_classes_business_class
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_tax_classes_business_code
        UNIQUE (
            business_id,
            code
        ),

    CONSTRAINT fk_tax_classes_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_tax_classes_code_not_blank
        CHECK (
            CHAR_LENGTH(TRIM(code)) > 0
        ),

    CONSTRAINT chk_tax_classes_name_not_blank
        CHECK (
            CHAR_LENGTH(TRIM(name)) > 0
        ),

    CONSTRAINT chk_tax_classes_description_not_blank
        CHECK (
            description IS NULL
            OR CHAR_LENGTH(TRIM(description)) > 0
        ),

    CONSTRAINT chk_tax_classes_type
        CHECK (
            tax_type IN (
                'VAT',
                'CONSUMPTION',
                'EXEMPT',
                'EXCLUDED',
                'NON_TAXED',
                'OTHER'
            )
        ),

    INDEX idx_tax_classes_business_active_name (
        business_id,
        is_active,
        name
    ),

    INDEX idx_tax_classes_business_type (
        business_id,
        tax_type
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS tax_rates (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    tax_class_id BIGINT UNSIGNED NOT NULL,

    rate DECIMAL(7, 4) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_tax_rates
        PRIMARY KEY (id),

    CONSTRAINT uq_tax_rates_business_rate
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_tax_rates_class_valid_from
        UNIQUE (
            business_id,
            tax_class_id,
            valid_from
        ),

    CONSTRAINT fk_tax_rates_tax_class
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

    CONSTRAINT chk_tax_rates_range
        CHECK (
            rate >= 0
            AND rate <= 100
        ),

    CONSTRAINT chk_tax_rates_validity
        CHECK (
            valid_to IS NULL
            OR valid_to >= valid_from
        ),

    INDEX idx_tax_rates_current_rate (
        business_id,
        tax_class_id,
        is_active,
        valid_from,
        valid_to
    )
) ENGINE = InnoDB;

ALTER TABLE products
    ADD COLUMN tax_class_id BIGINT UNSIGNED NULL
        AFTER current_price,

    ADD COLUMN price_includes_tax BOOLEAN NOT NULL DEFAULT TRUE
        AFTER tax_class_id,

    ADD CONSTRAINT fk_products_tax_class
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

    ADD INDEX idx_products_business_tax_class (
        business_id,
        tax_class_id
    );

DESCRIBE tax_classes;
DESCRIBE tax_rates;
DESCRIBE products;

SHOW CREATE TABLE tax_classes;
SHOW CREATE TABLE tax_rates;
