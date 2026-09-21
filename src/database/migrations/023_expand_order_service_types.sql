-- Migración 023: ampliación de las modalidades de servicio.
--
-- TABLE representa consumo en una mesa física.
-- TAKEAWAY representa pedidos realizados para llevar.
-- DELIVERY representa pedidos para entrega a domicilio.

USE sazora_db;

ALTER TABLE orders
    DROP CHECK chk_orders_table_matches_service;

ALTER TABLE orders
    DROP CHECK chk_orders_service_type;

-- Convierte cualquier dato anterior de mostrador a la nueva modalidad.
UPDATE orders
SET service_type = 'TAKEAWAY'
WHERE id > 0
    AND service_type = 'COUNTER';

ALTER TABLE orders
    ADD CONSTRAINT chk_orders_service_type
        CHECK (
            service_type IN (
                'TABLE',
                'TAKEAWAY',
                'DELIVERY'
            )
        ),

    ADD CONSTRAINT chk_orders_table_matches_service
        CHECK (
            (
                service_type = 'TABLE'
                AND restaurant_table_id IS NOT NULL
            )
            OR
            (
                service_type IN ('TAKEAWAY', 'DELIVERY')
                AND restaurant_table_id IS NULL
            )
        );

/*
Explicación:

- Solamente TABLE requiere una mesa física.
- TAKEAWAY y DELIVERY no ocupan una mesa.
- Una mesa física solo puede tener una orden activa.
- Ventanilla y domicilios pueden acumular varias órdenes activas.
- La modalidad de servicio no representa el origen del pedido.
- El origen POS, WEB o integración externa se añadirá por separado.
*/

SELECT
    id,
    service_type,
    restaurant_table_id,
    status
FROM orders
ORDER BY id;

SHOW CREATE TABLE orders;
