-- Migración 027: configuración administrativa y pública de cada negocio.

USE sazora_db;

CREATE TABLE IF NOT EXISTS business_settings (
    business_id BIGINT UNSIGNED NOT NULL,
    tagline VARCHAR(160) NULL,
    phone VARCHAR(30) NULL,
    address VARCHAR(250) NULL,
    opening_hours_text VARCHAR(200) NULL,
    instagram VARCHAR(100) NULL,
    tax_id VARCHAR(50) NULL,
    logo_url VARCHAR(500) NULL,
    primary_color CHAR(7) NOT NULL DEFAULT '#1F4534',
    accent_color CHAR(7) NOT NULL DEFAULT '#C2703C',
    kitchen_ticket_footer VARCHAR(500) NULL,
    public_menu_description VARCHAR(500) NULL,
    public_menu_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    public_ordering_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_settings
        PRIMARY KEY (business_id),

    CONSTRAINT fk_business_settings_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_business_settings_tagline
        CHECK (
            tagline IS NULL
            OR CHAR_LENGTH(TRIM(tagline)) > 0
        ),

    CONSTRAINT chk_business_settings_phone
        CHECK (
            phone IS NULL
            OR CHAR_LENGTH(TRIM(phone)) > 0
        ),

    CONSTRAINT chk_business_settings_address
        CHECK (
            address IS NULL
            OR CHAR_LENGTH(TRIM(address)) > 0
        ),

    CONSTRAINT chk_business_settings_opening_hours
        CHECK (
            opening_hours_text IS NULL
            OR CHAR_LENGTH(TRIM(opening_hours_text)) > 0
        ),

    CONSTRAINT chk_business_settings_instagram
        CHECK (
            instagram IS NULL
            OR CHAR_LENGTH(TRIM(instagram)) > 0
        ),

    CONSTRAINT chk_business_settings_tax_id
        CHECK (
            tax_id IS NULL
            OR CHAR_LENGTH(TRIM(tax_id)) > 0
        ),

    CONSTRAINT chk_business_settings_logo_url
        CHECK (
            logo_url IS NULL
            OR CHAR_LENGTH(TRIM(logo_url)) > 0
        ),

    CONSTRAINT chk_business_settings_primary_color
        CHECK (
            primary_color REGEXP '^#[0-9A-Fa-f]{6}$'
        ),

    CONSTRAINT chk_business_settings_accent_color
        CHECK (
            accent_color REGEXP '^#[0-9A-Fa-f]{6}$'
        ),

    CONSTRAINT chk_business_settings_ticket_footer
        CHECK (
            kitchen_ticket_footer IS NULL
            OR CHAR_LENGTH(TRIM(kitchen_ticket_footer)) > 0
        ),

    CONSTRAINT chk_business_settings_menu_description
        CHECK (
            public_menu_description IS NULL
            OR CHAR_LENGTH(TRIM(public_menu_description)) > 0
        ),

    CONSTRAINT chk_business_settings_ordering_requires_menu
        CHECK (
            public_ordering_enabled = FALSE
            OR public_menu_enabled = TRUE
        )
) ENGINE = InnoDB;

INSERT IGNORE INTO business_settings (
    business_id,
    kitchen_ticket_footer
)
SELECT
    id,
    'Gracias por tu trabajo en cocina'
FROM businesses;

DESCRIBE business_settings;

SHOW CREATE TABLE business_settings;
