-- Migración 033: entrega interna o mediante proveedor externo.

USE sazora_db;

ALTER TABLE public_order_deliveries
    ADD COLUMN delivery_mode VARCHAR(20) NULL
        AFTER order_id,
    ADD COLUMN external_provider_name VARCHAR(150) NULL
        AFTER assigned_driver_membership_id;

-- Las asignaciones existentes corresponden a empleados internos.

UPDATE public_order_deliveries
SET delivery_mode = 'INTERNAL'
WHERE assigned_driver_membership_id IS NOT NULL;

ALTER TABLE public_order_deliveries
    ADD CONSTRAINT chk_public_order_deliveries_mode
        CHECK (
            (
                delivery_mode IS NULL
                AND assigned_driver_membership_id IS NULL
                AND external_provider_name IS NULL
            )
            OR
            (
                delivery_mode = 'INTERNAL'
                AND assigned_driver_membership_id IS NOT NULL
                AND external_provider_name IS NULL
            )
            OR
            (
                delivery_mode = 'EXTERNAL'
                AND assigned_driver_membership_id IS NULL
            )
        );

SHOW CREATE TABLE public_order_deliveries;
