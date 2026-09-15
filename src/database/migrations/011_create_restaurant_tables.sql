-- ? Migración 011: creación de la tabla de mesas del restaurante.
--
-- ? Cada mesa pertenece a un negocio y tiene un código único dentro de él.

USE sazora_db;

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(80) NOT NULL,
    capacity SMALLINT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_restaurant_tables
        PRIMARY KEY (id),

    CONSTRAINT uq_restaurant_tables_business_table
        UNIQUE (business_id, id),

    CONSTRAINT uq_restaurant_tables_business_code
        UNIQUE (business_id, code),

    CONSTRAINT fk_restaurant_tables_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_restaurant_tables_code_not_blank
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_restaurant_tables_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_restaurant_tables_capacity_positive
        CHECK (capacity IS NULL OR capacity > 0),

    INDEX idx_restaurant_tables_business_active_name (
        business_id,
        is_active,
        name
    )
) ENGINE = InnoDB;

/*
Explicación:

- business_id identifica al negocio propietario de la mesa.
- code es el identificador operativo de la mesa, por ejemplo MESA-01.
- name es el nombre que verá el personal, por ejemplo Mesa 1 o Terraza 3.
- capacity indica opcionalmente cuántas personas puede recibir la mesa.
- El código no puede repetirse dentro del mismo negocio, pero dos negocios
  diferentes sí pueden utilizar el mismo código.
- is_active permite retirar una mesa del servicio sin eliminar su historial.
- No se almacena un campo como is_occupied. La ocupación se calculará a partir
  de los pedidos activos asociados con la mesa, evitando estados contradictorios.
- uq_restaurant_tables_business_table permitirá que orders utilice una llave
  foránea compuesta y garantice que el pedido y la mesa sean del mismo negocio.
- ON DELETE RESTRICT protege las mesas y su historial cuando un negocio tiene
  información relacionada.
*/

DESCRIBE restaurant_tables;

SHOW CREATE TABLE restaurant_tables;

SHOW INDEX FROM restaurant_tables;
