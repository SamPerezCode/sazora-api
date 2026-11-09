-- Migración 058:
-- Crea las cajas físicas o virtuales de cada ubicación y sus turnos.
--
-- Una ubicación habilitada para ventas puede tener una o varias cajas.
-- Cada caja solamente puede tener un turno abierto simultáneamente.

USE sazora_db;

CREATE TABLE IF NOT EXISTS cash_registers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,

    code VARCHAR(30) NOT NULL,
    name VARCHAR(120) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_cash_registers
        PRIMARY KEY (id),

    CONSTRAINT uq_cash_registers_business_register
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_cash_registers_location_code
        UNIQUE (
            business_id,
            location_id,
            code
        ),

    CONSTRAINT fk_cash_registers_location
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

    CONSTRAINT chk_cash_registers_code_not_blank
        CHECK (
            CHAR_LENGTH(TRIM(code)) > 0
        ),

    CONSTRAINT chk_cash_registers_name_not_blank
        CHECK (
            CHAR_LENGTH(TRIM(name)) > 0
        ),

    INDEX idx_cash_registers_location_active (
        business_id,
        location_id,
        is_active,
        name
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS cash_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    cash_register_id BIGINT UNSIGNED NOT NULL,

    opened_by_membership_id BIGINT UNSIGNED NOT NULL,
    closed_by_membership_id BIGINT UNSIGNED NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    currency_code CHAR(3) NOT NULL,

    opening_cash_amount DECIMAL(14, 2) NOT NULL,
    expected_cash_amount DECIMAL(14, 2) NULL,
    counted_cash_amount DECIMAL(14, 2) NULL,
    difference_amount DECIMAL(14, 2) NULL,

    opening_notes VARCHAR(500) NULL,
    closing_notes VARCHAR(500) NULL,

    opened_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    closed_at DATETIME(3) NULL,

    open_cash_register_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE
                WHEN status = 'OPEN'
                    THEN cash_register_id
                ELSE NULL
            END
        ) STORED,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_cash_sessions
        PRIMARY KEY (id),

    CONSTRAINT uq_cash_sessions_business_session
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_cash_sessions_one_open_per_register
        UNIQUE (
            business_id,
            open_cash_register_id
        ),

    CONSTRAINT fk_cash_sessions_register
        FOREIGN KEY (
            business_id,
            cash_register_id
        )
        REFERENCES cash_registers (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_cash_sessions_opened_by_membership
        FOREIGN KEY (
            business_id,
            opened_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_cash_sessions_closed_by_membership
        FOREIGN KEY (
            business_id,
            closed_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_cash_sessions_status
        CHECK (
            status IN (
                'OPEN',
                'CLOSED'
            )
        ),

    CONSTRAINT chk_cash_sessions_currency_code
        CHECK (
            currency_code REGEXP '^[A-Z]{3}$'
        ),

    CONSTRAINT chk_cash_sessions_opening_amount
        CHECK (
            opening_cash_amount >= 0
        ),

    CONSTRAINT chk_cash_sessions_expected_amount
        CHECK (
            expected_cash_amount IS NULL
            OR expected_cash_amount >= 0
        ),

    CONSTRAINT chk_cash_sessions_counted_amount
        CHECK (
            counted_cash_amount IS NULL
            OR counted_cash_amount >= 0
        ),

    CONSTRAINT chk_cash_sessions_opening_notes
        CHECK (
            opening_notes IS NULL
            OR CHAR_LENGTH(TRIM(opening_notes)) > 0
        ),

    CONSTRAINT chk_cash_sessions_closing_notes
        CHECK (
            closing_notes IS NULL
            OR CHAR_LENGTH(TRIM(closing_notes)) > 0
        ),

    CONSTRAINT chk_cash_sessions_state
        CHECK (
            (
                status = 'OPEN'
                AND closed_by_membership_id IS NULL
                AND expected_cash_amount IS NULL
                AND counted_cash_amount IS NULL
                AND difference_amount IS NULL
                AND closed_at IS NULL
            )
            OR
            (
                status = 'CLOSED'
                AND closed_by_membership_id IS NOT NULL
                AND expected_cash_amount IS NOT NULL
                AND counted_cash_amount IS NOT NULL
                AND difference_amount IS NOT NULL
                AND closed_at IS NOT NULL
            )
        ),

    INDEX idx_cash_sessions_register_opened (
        business_id,
        cash_register_id,
        opened_at
    ),

    INDEX idx_cash_sessions_status_opened (
        business_id,
        status,
        opened_at
    ),

    INDEX idx_cash_sessions_opened_by (
        business_id,
        opened_by_membership_id,
        opened_at
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE cash_registers;
SHOW CREATE TABLE cash_sessions;

SELECT
    TABLE_NAME
FROM information_schema.TABLES
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME IN (
        'cash_registers',
        'cash_sessions'
    )
ORDER BY TABLE_NAME;
