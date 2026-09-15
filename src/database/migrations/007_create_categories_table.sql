-- ?Migración 007: creación de la tabla de categorías.
--
-- ?Cada categoría pertenece a un negocio y permite organizar su catálogo.
-- Ejemplos: Panadería, Bebidas, Desayunos y Postres.

USE sazora_db;

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_categories
        PRIMARY KEY (id),

    CONSTRAINT uq_categories_business_name
        UNIQUE (business_id, name),

    CONSTRAINT fk_categories_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_categories_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_categories_business_active_order (
        business_id,
        is_active,
        display_order
    )
) ENGINE = InnoDB;

/*
Explicación:

- business_id identifica al negocio propietario de la categoría.
- name contiene el nombre mostrado en el catálogo.
- description es opcional.
- display_order permite controlar el orden mostrado en la interfaz.
- is_active permite ocultar la categoría sin eliminar su historial.
- UNIQUE (business_id, name) evita repetir un nombre dentro del mismo negocio.
- Dos negocios diferentes sí pueden tener categorías con el mismo nombre.
- ON DELETE RESTRICT impide eliminar un negocio que tenga categorías.
- El índice compuesto facilita consultar las categorías activas de un negocio
  en el orden configurado.
- Si una categoría está inactiva, sus productos no estarán disponibles para
  órdenes nuevas, aunque los productos conserven su propio estado.
*/

DESCRIBE categories;

SHOW CREATE TABLE categories;

SHOW INDEX FROM categories;
