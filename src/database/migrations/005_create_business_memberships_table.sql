-- ?Migración 005: pertenencias de usuarios a negocios.
--
-- *Esta tabla permite que un usuario pertenezca a uno o varios negocios.
-- Los roles se asignarán mediante otra tabla en la siguiente migración.

USE sazora_db;

CREATE TABLE IF NOT EXISTS business_memberships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_memberships
        PRIMARY KEY (id),

    CONSTRAINT uq_business_memberships_business_user
        UNIQUE (business_id, user_id),

    CONSTRAINT fk_business_memberships_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_business_memberships_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_business_memberships_user_id (user_id)
) ENGINE = InnoDB;

/*
Explicación:

- business_id identifica el negocio.
- user_id identifica la persona.
- La combinación UNIQUE impide relacionar dos veces al mismo usuario
  con el mismo negocio.
- is_active permite bloquear al usuario en un negocio sin bloquear su
  identidad global ni afectar sus otras pertenencias.
- ON DELETE RESTRICT impide eliminar negocios o usuarios relacionados.
- El índice de user_id acelera la búsqueda de los negocios de un usuario.
- No contiene role_id porque una pertenencia podrá tener varios roles.
*/

DESCRIBE business_memberships;

SHOW CREATE TABLE business_memberships;

SHOW INDEX FROM business_memberships;
