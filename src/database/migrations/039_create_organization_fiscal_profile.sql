-- Migración 039:
-- Crea el perfil legal y fiscal de la única organización operadora.
--
-- businesses continúa representando a la organización propietaria.
-- No se elimina business_id: se conserva como límite de integridad.
--
-- Esta tabla almacena la información que posteriormente se enviará
-- al proveedor de facturación electrónica. No emite facturas.

USE sazora_db;

CREATE TABLE IF NOT EXISTS organization_fiscal_profiles (
    business_id BIGINT UNSIGNED NOT NULL,

    legal_name VARCHAR(200) NOT NULL,
    commercial_name VARCHAR(200) NULL,

    person_type VARCHAR(20) NOT NULL,
    document_type VARCHAR(20) NOT NULL DEFAULT 'NIT',
    document_number VARCHAR(30) NOT NULL,
    verification_digit CHAR(1) NULL,

    tax_regime_code VARCHAR(30) NULL,
    vat_responsibility_code VARCHAR(30) NULL,
    consumption_tax_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    economic_activity_code VARCHAR(10) NULL,

    fiscal_address VARCHAR(250) NOT NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'CO',
    department_code VARCHAR(5) NULL,
    department_name VARCHAR(100) NOT NULL,
    municipality_code VARCHAR(10) NULL,
    municipality_name VARCHAR(100) NOT NULL,
    postal_code VARCHAR(12) NULL,

    billing_email VARCHAR(254) NOT NULL,
    billing_phone VARCHAR(30) NULL,

    administrative_contact_name VARCHAR(150) NULL,
    administrative_contact_email VARCHAR(254) NULL,
    administrative_contact_phone VARCHAR(30) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_organization_fiscal_profiles
        PRIMARY KEY (business_id),

    CONSTRAINT fk_organization_fiscal_profiles_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT uq_organization_fiscal_profiles_document
        UNIQUE (document_type, document_number),

    CONSTRAINT chk_organization_fiscal_profiles_person_type
        CHECK (
            person_type IN (
                'NATURAL_PERSON',
                'LEGAL_ENTITY'
            )
        ),

    CONSTRAINT chk_organization_fiscal_profiles_document_type
        CHECK (
            document_type IN (
                'NIT',
                'CC',
                'CE',
                'PASSPORT',
                'OTHER'
            )
        ),

    CONSTRAINT chk_organization_fiscal_profiles_legal_name
        CHECK (CHAR_LENGTH(TRIM(legal_name)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_document
        CHECK (CHAR_LENGTH(TRIM(document_number)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_verification_digit
        CHECK (
            verification_digit IS NULL
            OR verification_digit REGEXP '^[0-9]$'
        ),

    CONSTRAINT chk_organization_fiscal_profiles_country
        CHECK (country_code REGEXP '^[A-Z]{2}$'),

    CONSTRAINT chk_organization_fiscal_profiles_email
        CHECK (CHAR_LENGTH(TRIM(billing_email)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_address
        CHECK (CHAR_LENGTH(TRIM(fiscal_address)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_department
        CHECK (CHAR_LENGTH(TRIM(department_name)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_municipality
        CHECK (CHAR_LENGTH(TRIM(municipality_name)) > 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS organization_tax_responsibilities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_organization_tax_responsibilities
        PRIMARY KEY (id),

    CONSTRAINT uq_organization_tax_responsibilities
        UNIQUE (business_id, code),

    CONSTRAINT fk_organization_tax_responsibilities_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_organization_tax_responsibilities_code
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_organization_tax_responsibilities_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_organization_tax_responsibilities_active (
        business_id,
        is_active
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE organization_fiscal_profiles;
SHOW CREATE TABLE organization_tax_responsibilities;
