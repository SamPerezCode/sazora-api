-- Migración 071:
-- Crea o reactiva los permisos de Impuestos y los asigna al rol ADMIN.

USE sazora_db;

-- Crear o actualizar los permisos de Impuestos.

INSERT INTO permissions (
    code,
    module,
    name,
    description,
    is_active
)
VALUES
(
    'taxes.read',
    'taxes',
    'Consultar impuestos',
    'Permite consultar clases tributarias, tarifas y vigencias.',
    TRUE
),
(
    'taxes.manage',
    'taxes',
    'Administrar impuestos',
    'Permite crear y modificar clases tributarias y sus tarifas.',
    TRUE
)
ON DUPLICATE KEY UPDATE
    module = VALUES(module),
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Asignar ambos permisos al rol ADMIN.
-- Si la asociación ya existe, solamente se reactiva.

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
    ON p.code IN (
        'taxes.read',
        'taxes.manage'
    )
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
    71,
    '071_sync_admin_tax_permissions.sql',
    NULL,
    'MANUAL',
    'Crea o reactiva los permisos de Impuestos y los asigna al rol ADMIN.'
);

-- Verificar que los permisos existan y estén activos.

SELECT
    code,
    module,
    name,
    is_active
FROM permissions
WHERE code IN (
    'taxes.read',
    'taxes.manage'
)
ORDER BY code;

-- Verificar la asociación con ADMIN.

SELECT
    r.code AS role_code,
    p.code AS permission_code,
    p.is_active AS permission_is_active,
    rp.is_active AS role_permission_is_active
FROM role_permissions AS rp
INNER JOIN roles AS r
    ON r.id = rp.role_id
INNER JOIN permissions AS p
    ON p.id = rp.permission_id
WHERE
    r.code = 'ADMIN'
    AND p.code IN (
        'taxes.read',
        'taxes.manage'
    )
ORDER BY p.code;

-- Verificar el registro de la migración.

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 71;
