-- Migración 003: creación de la tabla de roles.
--
-- Los roles definen las funciones que una persona puede desempeñar.
-- Son globales; posteriormente se asignarán dentro de cada negocio.

USE sazora_db;

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_roles
        PRIMARY KEY (id),

    CONSTRAINT uq_roles_code
        UNIQUE (code),

    CONSTRAINT chk_roles_code_not_blank
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_roles_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE = InnoDB;

/*
Explicación:

- code es el identificador estable utilizado por el backend.
- name es el nombre que puede mostrarse a las personas.
- description explica la responsabilidad general del rol.
- is_active permite desactivar un rol sin eliminar sus asignaciones históricas.
- code es único para impedir roles duplicados.
*/

DESCRIBE roles;

SHOW CREATE TABLE roles;

SHOW INDEX FROM roles;
