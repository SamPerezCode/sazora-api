-- ?Migración 006: asignación de roles a las pertenencias.
--
-- *Permite que una persona tenga varios roles dentro del mismo negocio.
-- Ejemplo: una persona puede ser ADMIN y WAITER simultáneamente.

USE sazora_db;

CREATE TABLE IF NOT EXISTS business_membership_roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_membership_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_membership_roles
        PRIMARY KEY (id),

    CONSTRAINT uq_business_membership_roles_membership_role
        UNIQUE (business_membership_id, role_id),

    CONSTRAINT fk_business_membership_roles_membership
        FOREIGN KEY (business_membership_id)
        REFERENCES business_memberships (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_business_membership_roles_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_business_membership_roles_role_id (role_id)
) ENGINE = InnoDB;

/*
Explicación:

- business_membership_id identifica la pertenencia del usuario al negocio.
- role_id identifica el rol asignado.
- La restricción UNIQUE impide asignar dos veces el mismo rol.
- is_active permite retirar y posteriormente restaurar un rol sin eliminar
  físicamente la asignación.
- No guardamos business_id aquí porque ya se obtiene desde la pertenencia.
- ON DELETE RESTRICT protege el historial de asignaciones.
- El backend comprobará que el rol esté activo antes de asignarlo.
*/

DESCRIBE business_membership_roles;
SHOW CREATE TABLE business_membership_roles;
SHOW INDEX FROM business_membership_roles;
