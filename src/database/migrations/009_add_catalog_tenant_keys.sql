-- ? Migración 009: llaves compuestas para proteger el catálogo multiempresa.
--
-- ? Estas llaves permitirán comprobar que productos, categorías y áreas
-- pertenezcan siempre al mismo negocio.

USE sazora_db;

ALTER TABLE categories
    ADD CONSTRAINT uq_categories_business_category
        UNIQUE (business_id, id);

ALTER TABLE preparation_areas
    ADD CONSTRAINT uq_preparation_areas_business_area
        UNIQUE (business_id, id);

/*
Explicación:

- id ya es único globalmente en cada tabla.
- Estas llaves compuestas también declaran como única la combinación entre
  el negocio y el registro.
- products podrá usar llaves foráneas compuestas:
    (business_id, category_id) -> categories (business_id, id)
    (business_id, preparation_area_id)
        -> preparation_areas (business_id, id)
- Así MySQL rechazará relaciones entre negocios diferentes aunque exista
  un error en el backend.
- Los índices son parcialmente redundantes, pero están justificados por la
  protección estricta del aislamiento multiempresa.
*/

SHOW INDEX FROM categories;
SHOW INDEX FROM preparation_areas;
