-- Migración 022: referencias de imágenes para el catálogo.
--
-- Cada categoría y producto podrá tener una imagen opcional.
-- MySQL almacenará únicamente la referencia del archivo, no la imagen binaria.

USE sazora_db;

ALTER TABLE categories
    ADD COLUMN image_url VARCHAR(2048) NULL
        AFTER description,

    ADD CONSTRAINT chk_categories_image_url_not_blank
        CHECK (
            image_url IS NULL
            OR CHAR_LENGTH(TRIM(image_url)) > 0
        );

ALTER TABLE products
    ADD COLUMN image_url VARCHAR(2048) NULL
        AFTER description,

    ADD CONSTRAINT chk_products_image_url_not_blank
        CHECK (
            image_url IS NULL
            OR CHAR_LENGTH(TRIM(image_url)) > 0
        );

/*
Explicación:

- image_url es opcional.
- La columna contendrá la referencia pública o relativa de la imagen.
- No se guardarán archivos binarios ni imágenes Base64 en MySQL.
- VARCHAR(2048) permite almacenar rutas locales o direcciones de proveedores
  de almacenamiento externos.
- El CHECK impide guardar una cadena vacía o compuesta solo por espacios.
- Una categoría y un producto tendrán una sola imagen principal.
- Reemplazar una imagen actualizará esta referencia.
- Retirar una imagen establecerá image_url en NULL.
*/

DESCRIBE categories;
DESCRIBE products;

SHOW CREATE TABLE categories;
SHOW CREATE TABLE products;
