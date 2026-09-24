-- Migración 028: responsables programados para pedidos públicos y domicilios.

USE sazora_db;

CREATE TABLE IF NOT EXISTS public_order_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    assigned_membership_id BIGINT UNSIGNED NOT NULL,
    channel ENUM(
        'PUBLIC_ORDER',
        'DELIVERY'
    ) NOT NULL,
    specific_date DATE NULL,
    day_of_week TINYINT UNSIGNED NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    priority SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_membership_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_assignments
        PRIMARY KEY (id),

    CONSTRAINT fk_public_order_assignments_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_assignments_assignee
        FOREIGN KEY (
            business_id,
            assigned_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_assignments_creator
        FOREIGN KEY (
            business_id,
            created_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_public_order_assignments_schedule_type
        CHECK (
            (
                specific_date IS NOT NULL
                AND day_of_week IS NULL
            )
            OR
            (
                specific_date IS NULL
                AND day_of_week IS NOT NULL
            )
        ),

    CONSTRAINT chk_public_order_assignments_day
        CHECK (
            day_of_week IS NULL
            OR day_of_week BETWEEN 0 AND 6
        ),

    CONSTRAINT chk_public_order_assignments_time
        CHECK (start_time < end_time),

    CONSTRAINT chk_public_order_assignments_priority
        CHECK (priority <= 100),

    INDEX idx_public_order_assignments_lookup (
        business_id,
        channel,
        is_active,
        specific_date,
        day_of_week,
        start_time,
        end_time,
        priority
    ),

    INDEX idx_public_order_assignments_membership (
        business_id,
        assigned_membership_id,
        is_active
    )
) ENGINE = InnoDB;

DESCRIBE public_order_assignments;

SHOW CREATE TABLE public_order_assignments;

SHOW INDEX FROM public_order_assignments;
