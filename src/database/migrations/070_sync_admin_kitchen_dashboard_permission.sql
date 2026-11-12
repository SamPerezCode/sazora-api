-- Migración 070:
-- Agrega el permiso de acceso al tablero de Cocina a instalaciones
-- existentes y garantiza que ADMIN tenga todos los permisos activos.

USE sazora_db;

-- Crear o reactivar el permiso necesario para mostrar el módulo Cocina.

INSERT INTO permissions (
    code,
    module,
    name,
    description,
    is_active
)
VALUES (
    'kitchen.dashboard.read',
    'kitchen',
    'Acceder al tablero de cocina',
    'Permite acceder a la pantalla operativa del tablero de Cocina.',
    TRUE
)
ON DUPLICATE KEY UPDATE
    module = VALUES(module),
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- El rol operativo KITCHEN debe poder acceder al tablero de Cocina.

INSERT INTO role_permissions (
    role_id,
    permission_id,
    is_active
)
SELECT
    r.id,
    p.id,
    TRUE
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code = 'kitchen.dashboard.read'
WHERE
    r.code = 'KITCHEN'
    AND r.is_active = TRUE
    AND p.is_active = TRUE
ON DUPLICATE KEY UPDATE
    is_active = TRUE;

-- Regla de negocio:
-- ADMIN debe tener todos los permisos activos del sistema.

INSERT INTO role_permissions (
    role_id,
    permission_id,
    is_active
)
SELECT
    r.id,
    p.id,
    TRUE
FROM roles AS r
CROSS JOIN permissions AS p
WHERE
    r.code = 'ADMIN'
    AND r.is_active = TRUE
    AND p.is_active = TRUE
ON DUPLICATE KEY UPDATE
    is_active = TRUE;

-- Registrar la migración.

INSERT IGNORE INTO schema_migrations (
    migration_number,
    filename,
    checksum_sha256,
    execution_source,
    notes
)
VALUES (
    70,
    '070_sync_admin_kitchen_dashboard_permission.sql',
    NULL,
    'MANUAL',
    'Agrega el acceso al tablero de Cocina y sincroniza ADMIN con todos los permisos activos.'
);

-- Verificación de los permisos de Cocina.

SELECT
    r.code AS role_code,
    p.code AS permission_code,
    rp.is_active
FROM role_permissions AS rp
INNER JOIN roles AS r
    ON r.id = rp.role_id
INNER JOIN permissions AS p
    ON p.id = rp.permission_id
WHERE
    r.code IN ('ADMIN', 'KITCHEN')
    AND p.code LIKE 'kitchen.%'
ORDER BY
    r.code,
    p.code;

-- Verificación de la migración.

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 70;
