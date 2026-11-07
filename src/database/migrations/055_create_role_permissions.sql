-- Migración 055:
-- Crea el catálogo central de permisos y su relación con los roles.
--
-- Los roles continúan siendo grupos de responsabilidades.
-- Los permisos representan acciones concretas que puede ejecutar un usuario.

USE sazora_db;

-- Roles necesarios para los próximos módulos.

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'CASHIER',
    'Caja',
    'Gestiona aperturas, cobros, movimientos y cierres de caja.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'CASHIER'
);

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'INVENTORY_MANAGER',
    'Inventario',
    'Gestiona artículos, compras, movimientos, transferencias, costos y conciliaciones de inventario.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'INVENTORY_MANAGER'
);

CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    code VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_permissions
        PRIMARY KEY (id),

    CONSTRAINT uq_permissions_code
        UNIQUE (code),

    CONSTRAINT chk_permissions_code_not_blank
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_permissions_module_not_blank
        CHECK (CHAR_LENGTH(TRIM(module)) > 0),

    CONSTRAINT chk_permissions_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_permissions_module_active (
        module,
        is_active
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS role_permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_role_permissions
        PRIMARY KEY (id),

    CONSTRAINT uq_role_permissions_role_permission
        UNIQUE (
            role_id,
            permission_id
        ),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_role_permissions_permission_active (
        permission_id,
        is_active
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE permissions;
SHOW CREATE TABLE role_permissions;
