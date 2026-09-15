-- ? Migración 008: creación de las áreas de preparación.
--
-- ? Cada área representa una zona operativa que recibe productos.
-- Ejemplos: Cocina, Jugos, Bar, Panadería y Postres.

USE sazora_db;

CREATE TABLE IF NOT EXISTS preparation_areas (
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

    CONSTRAINT pk_preparation_areas
        PRIMARY KEY (id),

    CONSTRAINT uq_preparation_areas_business_name
        UNIQUE (business_id, name),

    CONSTRAINT fk_preparation_areas_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_preparation_areas_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_preparation_areas_business_active_order (
        business_id,
        is_active,
        display_order
    )
) ENGINE = InnoDB;

/*
Explicación:

- business_id identifica al negocio propietario del área.
- name contiene nombres como Cocina, Jugos o Bar.
- description permite explicar qué productos prepara la zona.
- display_order controla su posición en pantallas administrativas.
- is_active permite desactivar el área sin eliminar su historial.
- El nombre solo debe ser único dentro del mismo negocio.
- Categorías y áreas son independientes.
- Los productos se relacionarán posteriormente con preparation_areas.
- Las impresoras no se configuran todavía porque la impresión automática está
  fuera del MVP. En el futuro, esa configuración pertenecerá al área.
- ON DELETE RESTRICT impide eliminar un negocio que tenga áreas relacionadas.
*/

DESCRIBE preparation_areas;
SHOW CREATE TABLE preparation_areas;
SHOW INDEX FROM preparation_areas;
