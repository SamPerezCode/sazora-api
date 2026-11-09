-- Migración 060:
-- Crea el catálogo configurable de formas de pago del negocio.
--
-- El nombre y código son configurables.
-- payment_type determina el tratamiento financiero del pago.

USE sazora_db;

CREATE TABLE IF NOT EXISTS payment_methods (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    payment_type VARCHAR(30) NOT NULL,

    requires_reference BOOLEAN NOT NULL DEFAULT FALSE,
    affects_cash BOOLEAN NOT NULL DEFAULT FALSE,
    allows_change BOOLEAN NOT NULL DEFAULT FALSE,

    display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_payment_methods
        PRIMARY KEY (id),

    CONSTRAINT uq_payment_methods_business_method
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT uq_payment_methods_business_code
        UNIQUE (
            business_id,
            code
        ),

    CONSTRAINT fk_payment_methods_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_payment_methods_code
        CHECK (
            CHAR_LENGTH(TRIM(code)) > 0
        ),

    CONSTRAINT chk_payment_methods_name
        CHECK (
            CHAR_LENGTH(TRIM(name)) > 0
        ),

    CONSTRAINT chk_payment_methods_type
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

    CONSTRAINT chk_payment_methods_affects_cash
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

    CONSTRAINT chk_payment_methods_allows_change
        CHECK (
            allows_change = FALSE
            OR payment_type = 'CASH'
        ),

    INDEX idx_payment_methods_business_active_order (
        business_id,
        is_active,
        display_order,
        name
    ),

    INDEX idx_payment_methods_business_type (
        business_id,
        payment_type,
        is_active
    )
) ENGINE = InnoDB;

-- Métodos iniciales para los negocios existentes.

INSERT INTO payment_methods (
    business_id,
    code,
    name,
    payment_type,
    requires_reference,
    affects_cash,
    allows_change,
    display_order
)
SELECT
    b.id,
    'CASH',
    'Efectivo',
    'CASH',
    FALSE,
    TRUE,
    TRUE,
    10
FROM businesses AS b
WHERE NOT EXISTS (
    SELECT 1
    FROM payment_methods AS pm
    WHERE
        pm.business_id = b.id
        AND pm.code = 'CASH'
);

INSERT INTO payment_methods (
    business_id,
    code,
    name,
    payment_type,
    requires_reference,
    affects_cash,
    allows_change,
    display_order
)
SELECT
    b.id,
    'CARD',
    'Tarjeta / datáfono',
    'CARD',
    TRUE,
    FALSE,
    FALSE,
    20
FROM businesses AS b
WHERE NOT EXISTS (
    SELECT 1
    FROM payment_methods AS pm
    WHERE
        pm.business_id = b.id
        AND pm.code = 'CARD'
);

INSERT INTO payment_methods (
    business_id,
    code,
    name,
    payment_type,
    requires_reference,
    affects_cash,
    allows_change,
    display_order
)
SELECT
    b.id,
    'BANK_TRANSFER',
    'Transferencia bancaria',
    'BANK_TRANSFER',
    TRUE,
    FALSE,
    FALSE,
    30
FROM businesses AS b
WHERE NOT EXISTS (
    SELECT 1
    FROM payment_methods AS pm
    WHERE
        pm.business_id = b.id
        AND pm.code = 'BANK_TRANSFER'
);

INSERT INTO payment_methods (
    business_id,
    code,
    name,
    payment_type,
    requires_reference,
    affects_cash,
    allows_change,
    display_order
)
SELECT
    b.id,
    'DIGITAL_WALLET',
    'Billetera digital',
    'DIGITAL_WALLET',
    TRUE,
    FALSE,
    FALSE,
    40
FROM businesses AS b
WHERE NOT EXISTS (
    SELECT 1
    FROM payment_methods AS pm
    WHERE
        pm.business_id = b.id
        AND pm.code = 'DIGITAL_WALLET'
);

SHOW CREATE TABLE payment_methods;

SELECT
    id,
    business_id,
    code,
    name,
    payment_type,
    requires_reference,
    affects_cash,
    allows_change,
    display_order,
    is_active
FROM payment_methods
ORDER BY
    business_id,
    display_order,
    id;
