-- Migración 059:
-- Registra los movimientos de efectivo ocurridos durante un turno de caja.
--
-- Los movimientos son inmutables. Una corrección posterior deberá
-- registrarse mediante un nuevo movimiento compensatorio.

USE sazora_db;

CREATE TABLE IF NOT EXISTS cash_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    cash_session_id BIGINT UNSIGNED NOT NULL,
    recorded_by_membership_id BIGINT UNSIGNED NOT NULL,

    movement_type VARCHAR(30) NOT NULL,
    amount DECIMAL(14, 2) NOT NULL,

    reason VARCHAR(500) NOT NULL,
    reference VARCHAR(120) NULL,

    source_type VARCHAR(30) NULL,
    source_id BIGINT UNSIGNED NULL,

    occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_cash_movements
        PRIMARY KEY (id),

    CONSTRAINT uq_cash_movements_business_movement
        UNIQUE (
            business_id,
            id
        ),

    CONSTRAINT fk_cash_movements_session
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

    CONSTRAINT fk_cash_movements_recorded_by
        FOREIGN KEY (
            business_id,
            recorded_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_cash_movements_type
        CHECK (
            movement_type IN (
                'MANUAL_INCOME',
                'WITHDRAWAL',
                'EXPENSE',
                'CASH_SALE',
                'CASH_REFUND',
                'ADJUSTMENT_IN',
                'ADJUSTMENT_OUT'
            )
        ),

    CONSTRAINT chk_cash_movements_amount
        CHECK (
            amount > 0
        ),

    CONSTRAINT chk_cash_movements_reason
        CHECK (
            CHAR_LENGTH(TRIM(reason)) > 0
        ),

    CONSTRAINT chk_cash_movements_reference
        CHECK (
            reference IS NULL
            OR CHAR_LENGTH(TRIM(reference)) > 0
        ),

    CONSTRAINT chk_cash_movements_source
        CHECK (
            (
                source_type IS NULL
                AND source_id IS NULL
                AND movement_type IN (
                    'MANUAL_INCOME',
                    'WITHDRAWAL',
                    'EXPENSE',
                    'ADJUSTMENT_IN',
                    'ADJUSTMENT_OUT'
                )
            )
            OR
            (
                source_type = 'SALE_PAYMENT'
                AND source_id IS NOT NULL
                AND movement_type = 'CASH_SALE'
            )
            OR
            (
                source_type = 'REFUND_PAYMENT'
                AND source_id IS NOT NULL
                AND movement_type = 'CASH_REFUND'
            )
        ),

    INDEX idx_cash_movements_session_occurred (
        business_id,
        cash_session_id,
        occurred_at,
        id
    ),

    INDEX idx_cash_movements_type_occurred (
        business_id,
        movement_type,
        occurred_at
    ),

    INDEX idx_cash_movements_recorded_by (
        business_id,
        recorded_by_membership_id,
        occurred_at
    ),

    INDEX idx_cash_movements_source (
        business_id,
        source_type,
        source_id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE cash_movements;

SELECT
    COLUMN_NAME,
    COLUMN_TYPE,
    IS_NULLABLE
FROM information_schema.COLUMNS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cash_movements'
ORDER BY ORDINAL_POSITION;

SELECT
    CONSTRAINT_NAME,
    CONSTRAINT_TYPE
FROM information_schema.TABLE_CONSTRAINTS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'cash_movements'
ORDER BY CONSTRAINT_NAME;
