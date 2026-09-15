-- ? Migración 018: llaves de contexto para los elementos de las comandas.
--
-- ? Estas llaves permitirán comprobar que la comanda y el producto enviado
-- pertenezcan al mismo negocio, la misma orden y la misma área de preparación.

USE sazora_db;

ALTER TABLE order_items
    ADD CONSTRAINT uq_order_items_business_item_order_area
        UNIQUE (
            business_id,
            id,
            order_id,
            preparation_area_id
        );

ALTER TABLE kitchen_tickets
    ADD CONSTRAINT uq_kitchen_tickets_business_ticket_order_area
        UNIQUE (
            business_id,
            id,
            order_id,
            preparation_area_id
        );

/*
Explicación:

- order_items ya conoce su negocio, orden y área de preparación.
- kitchen_tickets también conoce su negocio, orden y área de preparación.
- Las llaves compuestas permitirán que kitchen_ticket_items relacione ambas
  tablas utilizando todo ese contexto.
- MySQL rechazará un producto si se intenta colocar en una comanda de otra
  orden, otra área o un negocio diferente.
- Estas migraciones ALTER deben ejecutarse una sola vez. Si se repiten, MySQL
  informará que los nombres de las llaves ya existen.
*/

SHOW INDEX FROM order_items;

SHOW INDEX FROM kitchen_tickets;
