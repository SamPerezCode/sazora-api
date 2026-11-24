USE sazora_db;

INSERT INTO permissions (
    code,
    module,
    name,
    description,
    is_active
)
VALUES
(
    'customers.read',
    'customers',
    'Consultar clientes',
    'Permite consultar clientes y su resumen comercial.',
    TRUE
),
(
    'customers.manage',
    'customers',
    'Administrar clientes',
    'Permite actualizar información y consentimiento comercial de clientes.',
    TRUE
)
ON DUPLICATE KEY UPDATE
    module = VALUES(module),
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- Caja y responsables de solicitudes pueden consultar clientes.

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
    r.code IN (
        'CASHIER',
        'PUBLIC_ORDER_MANAGER'
    )
    AND r.is_active = TRUE
    AND p.code = 'customers.read'
    AND p.is_active = TRUE
ON DUPLICATE KEY UPDATE
    is_active = TRUE;

-- ADMIN recibe ambos permisos.

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
    AND p.code IN (
        'customers.read',
        'customers.manage'
    )
    AND p.is_active = TRUE
ON DUPLICATE KEY UPDATE
    is_active = TRUE;

INSERT IGNORE INTO schema_migrations (
    migration_number,
    filename,
    checksum_sha256,
    execution_source,
    notes
)
VALUES (
    79,
    '079_add_commercial_customer_permissions.sql',
    NULL,
    'MANUAL',
    'Agrega permisos para consultar y administrar clientes comerciales.'
);

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
    p.code IN (
        'customers.read',
        'customers.manage'
    )
ORDER BY
    r.code,
    p.code;

SELECT
    migration_number,
    filename,
    execution_source,
    applied_at
FROM schema_migrations
WHERE migration_number = 79;
