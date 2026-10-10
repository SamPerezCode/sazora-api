-- Migración 040:
-- Crea la red operativa de la organización y los clientes comerciales.
--
-- Una ubicación propia puede ser:
-- - Planta/bodega de producción.
-- - Punto de venta.
--
-- Los clientes mayoristas son terceros. No deben registrarse como sedes.

USE sazora_db;

CREATE TABLE IF NOT EXISTS business_locations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    location_type VARCHAR(30) NOT NULL,

    address VARCHAR(250) NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'CO',
    department_code VARCHAR(5) NULL,
    department_name VARCHAR(100) NULL,
    municipality_code VARCHAR(10) NULL,
    municipality_name VARCHAR(100) NULL,
    postal_code VARCHAR(12) NULL,

    phone VARCHAR(30) NULL,
    email VARCHAR(254) NULL,

    is_inventory_location BOOLEAN NOT NULL DEFAULT TRUE,
    is_production_location BOOLEAN NOT NULL DEFAULT FALSE,
    is_sales_location BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_locations
        PRIMARY KEY (id),

    CONSTRAINT uq_business_locations_business_location
        UNIQUE (business_id, id),

    CONSTRAINT uq_business_locations_business_code
        UNIQUE (business_id, code),

    CONSTRAINT fk_business_locations_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_business_locations_type
        CHECK (
            location_type IN (
                'PRODUCTION_WAREHOUSE',
                'POINT_OF_SALE'
            )
        ),

    CONSTRAINT chk_business_locations_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_business_locations_code
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_business_locations_capability
        CHECK (
            is_inventory_location = TRUE
            OR is_production_location = TRUE
            OR is_sales_location = TRUE
        ),

    INDEX idx_business_locations_type_active (
        business_id,
        location_type,
        is_active
    )
) ENGINE = InnoDB;

-- Crea una ubicación provisional para conservar la operación existente.
-- El administrador deberá editarla y clasificarla correctamente.
INSERT INTO business_locations (
    business_id,
    code,
    name,
    location_type,
    address,
    phone,
    is_inventory_location,
    is_production_location,
    is_sales_location
)
SELECT
    b.id,
    'PRINCIPAL',
    'Ubicación principal por configurar',
    'POINT_OF_SALE',
    bs.address,
    bs.phone,
    TRUE,
    FALSE,
    TRUE
FROM businesses AS b
LEFT JOIN business_settings AS bs
    ON bs.business_id = b.id
WHERE NOT EXISTS (
    SELECT 1
    FROM business_locations AS bl
    WHERE bl.business_id = b.id
);

CREATE TABLE IF NOT EXISTS business_membership_locations (
    business_id BIGINT UNSIGNED NOT NULL,
    business_membership_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_membership_locations
        PRIMARY KEY (
            business_id,
            business_membership_id,
            location_id
        ),

    CONSTRAINT fk_membership_locations_membership
        FOREIGN KEY (
            business_id,
            business_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_membership_locations_location
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

    INDEX idx_membership_locations_location (
        business_id,
        location_id
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS commercial_customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    customer_type VARCHAR(20) NOT NULL,
    legal_name VARCHAR(200) NOT NULL,
    commercial_name VARCHAR(200) NULL,

    document_type VARCHAR(20) NOT NULL,
    document_number VARCHAR(30) NOT NULL,
    verification_digit CHAR(1) NULL,

    billing_email VARCHAR(254) NULL,
    billing_phone VARCHAR(30) NULL,

    fiscal_address VARCHAR(250) NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'CO',
    department_code VARCHAR(5) NULL,
    department_name VARCHAR(100) NULL,
    municipality_code VARCHAR(10) NULL,
    municipality_name VARCHAR(100) NULL,
    postal_code VARCHAR(12) NULL,

    tax_regime_code VARCHAR(30) NULL,
    vat_responsibility_code VARCHAR(30) NULL,

    payment_term_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    requires_electronic_invoice BOOLEAN NOT NULL DEFAULT TRUE,

    notes VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_commercial_customers
        PRIMARY KEY (id),

    CONSTRAINT uq_commercial_customers_business_customer
        UNIQUE (business_id, id),

    CONSTRAINT uq_commercial_customers_document
        UNIQUE (
            business_id,
            document_type,
            document_number
        ),

    CONSTRAINT fk_commercial_customers_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_commercial_customers_type
        CHECK (
            customer_type IN (
                'PERSON',
                'COMPANY'
            )
        ),

    CONSTRAINT chk_commercial_customers_document_type
        CHECK (
            document_type IN (
                'NIT',
                'CC',
                'CE',
                'PASSPORT',
                'OTHER'
            )
        ),

    CONSTRAINT chk_commercial_customers_legal_name
        CHECK (CHAR_LENGTH(TRIM(legal_name)) > 0),

    CONSTRAINT chk_commercial_customers_document
        CHECK (CHAR_LENGTH(TRIM(document_number)) > 0),

    CONSTRAINT chk_commercial_customers_verification_digit
        CHECK (
            verification_digit IS NULL
            OR verification_digit REGEXP '^[0-9]$'
        ),

    INDEX idx_commercial_customers_active_name (
        business_id,
        is_active,
        legal_name
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS commercial_customer_delivery_locations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(150) NOT NULL,
    address VARCHAR(250) NOT NULL,

    country_code CHAR(2) NOT NULL DEFAULT 'CO',
    department_code VARCHAR(5) NULL,
    department_name VARCHAR(100) NULL,
    municipality_code VARCHAR(10) NULL,
    municipality_name VARCHAR(100) NULL,
    postal_code VARCHAR(12) NULL,

    contact_name VARCHAR(150) NULL,
    contact_phone VARCHAR(30) NULL,
    delivery_notes VARCHAR(500) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_commercial_customer_delivery_locations
        PRIMARY KEY (id),

    CONSTRAINT uq_customer_delivery_locations_business_location
        UNIQUE (business_id, id),

    CONSTRAINT uq_customer_delivery_locations_customer_location
        UNIQUE (business_id, customer_id, id),

    CONSTRAINT fk_customer_delivery_locations_customer
        FOREIGN KEY (
            business_id,
            customer_id
        )
        REFERENCES commercial_customers (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_customer_delivery_locations_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_customer_delivery_locations_address
        CHECK (CHAR_LENGTH(TRIM(address)) > 0),

    INDEX idx_customer_delivery_locations_customer (
        business_id,
        customer_id,
        is_active
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE business_locations;
SHOW CREATE TABLE business_membership_locations;
SHOW CREATE TABLE commercial_customers;
SHOW CREATE TABLE commercial_customer_delivery_locations;
