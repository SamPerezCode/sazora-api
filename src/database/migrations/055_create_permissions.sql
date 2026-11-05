-- Migración 055: catálogo de permisos y relación entre roles y permisos.

USE sazora_db;

-- Agrega el rol encargado de las operaciones de caja.

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'CASHIER',
    'Caja',
    'Gestiona cobros, aperturas, cierres y movimientos de caja.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'CASHIER'
);

-- Agrega el rol encargado de las operaciones de inventario.

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'INVENTORY_MANAGER',
    'Inventario',
    'Gestiona existencias, compras, movimientos, transferencias y conciliaciones.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'INVENTORY_MANAGER'
);

-- Catálogo global de permisos disponibles en la aplicación.

CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    code VARCHAR(120) NOT NULL,
    module VARCHAR(60) NOT NULL,
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
        CHECK (
            CHAR_LENGTH(TRIM(code)) > 0
        ),

    CONSTRAINT chk_permissions_module_not_blank
        CHECK (
            CHAR_LENGTH(TRIM(module)) > 0
        ),

    CONSTRAINT chk_permissions_name_not_blank
        CHECK (
            CHAR_LENGTH(TRIM(name)) > 0
        ),

    INDEX idx_permissions_module_active (
        module,
        is_active
    )
) ENGINE = InnoDB;

-- Relación de permisos asignados a cada rol.

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

    INDEX idx_role_permissions_permission (
        permission_id,
        is_active
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE permissions;
SHOW CREATE TABLE role_permissions;
