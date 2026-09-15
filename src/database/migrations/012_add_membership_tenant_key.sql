-- ? Migración 012: llave compuesta para proteger las operaciones multiempresa.
--
-- ? Esta llave permitirá comprobar que el empleado y la orden pertenezcan
-- al mismo negocio.

USE sazora_db;

ALTER TABLE business_memberships
    ADD CONSTRAINT uq_business_memberships_business_membership
        UNIQUE (business_id, id);

/*
Explicación:

- id ya identifica globalmente una pertenencia.
- La combinación (business_id, id) también declara explícitamente a qué
  negocio pertenece esa relación.
- Las tablas operativas podrán utilizar una llave foránea compuesta para
  impedir que una operación de un negocio sea registrada por una pertenencia
  correspondiente a otro negocio.
- Esta migración debe ejecutarse una sola vez. Si se repite, MySQL informará
  que el nombre de la llave ya existe.
*/

SHOW INDEX FROM business_memberships;
