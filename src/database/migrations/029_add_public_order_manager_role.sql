-- Migración 029:
-- Agrega el rol de gestor de pedidos públicos y permite responsables
-- permanentes o programados.

USE sazora_db;

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'PUBLIC_ORDER_MANAGER',
    'Gestor de pedidos públicos',
    'Gestiona solicitudes creadas desde el menú público.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'PUBLIC_ORDER_MANAGER'
);

ALTER TABLE public_order_assignments
    DROP CHECK chk_public_order_assignments_schedule_type;

ALTER TABLE public_order_assignments
    DROP CHECK chk_public_order_assignments_time;

ALTER TABLE public_order_assignments
    DROP INDEX idx_public_order_assignments_lookup;

ALTER TABLE public_order_assignments
    ADD COLUMN service_scope ENUM(
        'ALL',
        'DELIVERY',
        'TAKEAWAY'
    ) NOT NULL DEFAULT 'ALL'
    AFTER assigned_membership_id;

ALTER TABLE public_order_assignments
    DROP COLUMN channel;

ALTER TABLE public_order_assignments
    MODIFY COLUMN start_time TIME NULL,
    MODIFY COLUMN end_time TIME NULL;

ALTER TABLE public_order_assignments
    ADD CONSTRAINT chk_public_order_assignments_schedule
        CHECK (
            (
                specific_date IS NULL
                AND day_of_week IS NULL
                AND start_time IS NULL
                AND end_time IS NULL
            )
            OR
            (
                specific_date IS NULL
                AND day_of_week IS NOT NULL
                AND start_time IS NOT NULL
                AND end_time IS NOT NULL
                AND start_time < end_time
            )
            OR
            (
                specific_date IS NOT NULL
                AND day_of_week IS NULL
                AND start_time IS NOT NULL
                AND end_time IS NOT NULL
                AND start_time < end_time
            )
        );

CREATE INDEX idx_public_order_assignments_lookup
    ON public_order_assignments (
        business_id,
        service_scope,
        is_active,
        specific_date,
        day_of_week,
        start_time,
        end_time,
        priority
    );

SELECT
    id,
    code,
    name,
    description,
    is_active
FROM roles
WHERE code = 'PUBLIC_ORDER_MANAGER';

SHOW CREATE TABLE public_order_assignments;
