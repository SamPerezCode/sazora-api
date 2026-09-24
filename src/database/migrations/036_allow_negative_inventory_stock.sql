-- Migración 036:
-- Permite que el inventario refleje existencias negativas.
--
-- Un saldo negativo representa una diferencia entre el inventario
-- registrado y la existencia física. No debe bloquear ventas,
-- producción ni otros movimientos reales.

USE sazora_db;

ALTER TABLE inventory_items
    DROP CHECK chk_inventory_items_stock;

ALTER TABLE inventory_items
    ADD CONSTRAINT chk_inventory_items_minimum_stock
        CHECK (minimum_stock >= 0);

ALTER TABLE inventory_movement_lines
    DROP CHECK chk_inventory_movement_lines_balances;

SHOW CREATE TABLE inventory_items;
SHOW CREATE TABLE inventory_movement_lines;
