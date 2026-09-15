-- ?Migración 002: creación de la tabla de negocios.
--
-- *Cada registro representa un restaurante, cafetería, panadería u otro
-- establecimiento independiente que utiliza Sazora.

USE sazora_db;

--! businesses representa a cada negocio independiente que utiliza Sazora.
CREATE TABLE IF NOT EXISTS businesses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
    currency_code CHAR(3) NOT NULL DEFAULT 'COP',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_businesses
        PRIMARY KEY (id),

    CONSTRAINT uq_businesses_slug
        UNIQUE (slug),

    CONSTRAINT chk_businesses_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_businesses_slug_not_blank
        CHECK (CHAR_LENGTH(TRIM(slug)) > 0)
) ENGINE = InnoDB;

/*
Explicación:

- BIGINT UNSIGNED permite identificadores positivos de gran capacidad.
- AUTO_INCREMENT genera automáticamente el siguiente identificador.
- VARCHAR establece una longitud máxima sin rellenar espacios.
- slug identifica el negocio de forma legible y debe ser único.
- CHAR(3) almacena códigos de moneda como COP, USD o EUR.
- BOOLEAN representa un valor verdadero o falso. MySQL lo almacena
  internamente como TINYINT.
- DATETIME(3) conserva fecha, hora y milisegundos.
- CURRENT_TIMESTAMP(3) genera automáticamente la fecha actual.
- ON UPDATE actualiza updated_at cuando cambia el registro.
- CHECK impide guardar nombres o slugs vacíos.
- InnoDB permite llaves foráneas y transacciones.
*/

-- Verificaciones manuales. Estas consultas no modifican información.

DESCRIBE businesses;

SHOW CREATE TABLE businesses;

SHOW INDEX FROM businesses;
