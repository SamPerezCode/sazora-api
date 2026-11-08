-- Seed 002: catálogo inicial de permisos y asignaciones por rol.

USE sazora_db;

INSERT INTO permissions (
    code,
    module,
    name,
    description
)
VALUES
    (
        'dashboard.read',
        'dashboard',
        'Consultar resumen',
        'Permite consultar el resumen operativo del negocio.'
    ),

    (
        'business.settings.read',
        'business',
        'Consultar configuración',
        'Permite consultar la configuración del negocio.'
    ),
    (
        'business.settings.manage',
        'business',
        'Administrar configuración',
        'Permite modificar la configuración del negocio.'
    ),
    (
        'organization.profile.read',
        'business',
        'Consultar perfil fiscal',
        'Permite consultar el perfil organizacional y fiscal.'
    ),
    (
        'organization.profile.manage',
        'business',
        'Administrar perfil fiscal',
        'Permite modificar el perfil organizacional y fiscal.'
    ),

    (
        'employees.read',
        'employees',
        'Consultar empleados',
        'Permite consultar empleados, roles y asignaciones.'
    ),
    (
        'employees.manage',
        'employees',
        'Administrar empleados',
        'Permite crear y modificar empleados, roles y ubicaciones.'
    ),

    (
        'locations.read',
        'locations',
        'Consultar ubicaciones',
        'Permite consultar ubicaciones del negocio.'
    ),
    (
        'locations.manage',
        'locations',
        'Administrar ubicaciones',
        'Permite crear y modificar ubicaciones.'
    ),

    (
        'catalog.read',
        'catalog',
        'Consultar catálogo',
        'Permite consultar categorías y productos.'
    ),
    (
        'catalog.manage',
        'catalog',
        'Administrar catálogo',
        'Permite crear y modificar categorías, productos y combos.'
    ),

    (
        'tables.read',
        'tables',
        'Consultar mesas',
        'Permite consultar mesas del punto de venta.'
    ),
    (
        'tables.manage',
        'tables',
        'Administrar mesas',
        'Permite crear y modificar mesas.'
    ),

    (
        'orders.read',
        'orders',
        'Consultar pedidos',
        'Permite consultar pedidos y su historial.'
    ),
    (
        'orders.manage',
        'orders',
        'Administrar pedidos',
        'Permite crear y modificar pedidos y sus productos.'
    ),
    (
        'orders.cancel',
        'orders',
        'Cancelar pedidos',
        'Permite cancelar pedidos o cantidades de productos.'
    ),
    (
        'orders.close',
        'orders',
        'Cerrar pedidos',
        'Permite cerrar y entregar pedidos.'
    ),

    (
        'kitchen.dashboard.read',
        'kitchen',
        'Acceder al tablero de cocina',
        'Permite acceder a la pantalla operativa del tablero de Cocina.'
    ),
    (
        'kitchen.settings.read',
        'kitchen',
        'Consultar configuración de cocina',
        'Permite consultar áreas y configuración de cocina.'
    ),
    (
        'kitchen.settings.manage',
        'kitchen',
        'Administrar configuración de cocina',
        'Permite modificar áreas y configuración de cocina.'
    ),
    (
        'kitchen.tickets.read',
        'kitchen',
        'Consultar comandas',
        'Permite consultar comandas de cocina.'
    ),
    (
        'kitchen.tickets.update',
        'kitchen',
        'Actualizar comandas',
        'Permite modificar estados de comandas y productos.'
    ),
    (
        'kitchen.tickets.print',
        'kitchen',
        'Imprimir comandas',
        'Permite imprimir y reimprimir comandas.'
    ),

    (
        'inventory.items.read',
        'inventory',
        'Consultar artículos',
        'Permite consultar el catálogo de artículos de inventario.'
    ),
    (
        'inventory.items.manage',
        'inventory',
        'Administrar artículos',
        'Permite crear y modificar artículos de inventario.'
    ),
    (
        'inventory.balances.read',
        'inventory',
        'Consultar existencias',
        'Permite consultar existencias por ubicación autorizada.'
    ),
    (
        'inventory.movements.read',
        'inventory',
        'Consultar movimientos',
        'Permite consultar movimientos de inventario.'
    ),
    (
        'inventory.movements.create',
        'inventory',
        'Registrar movimientos',
        'Permite registrar movimientos manuales de inventario.'
    ),
    (
        'inventory.purchases.read',
        'inventory',
        'Consultar compras',
        'Permite consultar compras de inventario.'
    ),
    (
        'inventory.purchases.create',
        'inventory',
        'Registrar compras',
        'Permite registrar compras e ingresos de inventario.'
    ),
    (
        'inventory.transfers.create',
        'inventory',
        'Crear transferencias',
        'Permite transferir inventario entre ubicaciones.'
    ),
    (
        'inventory.valuation.manage',
        'inventory',
        'Administrar valoración',
        'Permite registrar y modificar la valoración inicial.'
    ),
    (
        'inventory.reports.read',
        'inventory',
        'Consultar informes',
        'Permite consultar resumen, Kardex y costos.'
    ),
    (
        'inventory.reconciliation.read',
        'inventory',
        'Consultar conciliación',
        'Permite consultar diferencias de conciliación.'
    ),
    (
        'inventory.reconciliation.execute',
        'inventory',
        'Ejecutar conciliación',
        'Permite ejecutar ajustes de conciliación cuando se implemente.'
    ),
    (
        'inventory.links.manage',
        'inventory',
        'Configurar productos e inventario',
        'Permite vincular productos comerciales con inventario.'
    ),

    (
        'production.recipes.read',
        'production',
        'Consultar recetas',
        'Permite consultar recetas de producción.'
    ),
    (
        'production.recipes.manage',
        'production',
        'Administrar recetas',
        'Permite crear y modificar recetas.'
    ),
    (
        'production.quick.create',
        'production',
        'Registrar producción rápida',
        'Permite registrar transformaciones de producción rápida.'
    ),
    (
        'production.orders.read',
        'production',
        'Consultar órdenes de producción',
        'Permite consultar órdenes de producción.'
    ),
    (
        'production.orders.manage',
        'production',
        'Administrar órdenes de producción',
        'Permite crear, planificar, modificar y cancelar órdenes.'
    ),
    (
        'production.orders.execute',
        'production',
        'Ejecutar órdenes de producción',
        'Permite iniciar y completar órdenes de producción.'
    ),
    (
        'production.waste.read',
        'production',
        'Consultar desperdicios',
        'Permite consultar desperdicios de producción.'
    ),
    (
        'production.waste.create',
        'production',
        'Registrar desperdicios',
        'Permite registrar desperdicios de producción.'
    ),
    (
        'production.reports.read',
        'production',
        'Consultar informes de producción',
        'Permite consultar rendimiento e informes de producción.'
    ),

    (
        'sales.reports.read',
        'sales',
        'Consultar informes de ventas',
        'Permite consultar informes comerciales y operativos.'
    ),

    (
        'public_menu.manage',
        'public_orders',
        'Administrar menú público',
        'Permite modificar la configuración del menú público.'
    ),
    (
        'public_orders.read',
        'public_orders',
        'Consultar pedidos públicos',
        'Permite consultar solicitudes creadas desde el menú público.'
    ),
    (
        'public_orders.manage',
        'public_orders',
        'Administrar pedidos públicos',
        'Permite aceptar, rechazar y gestionar pedidos públicos.'
    ),
    (
        'public_orders.assign',
        'public_orders',
        'Asignar pedidos públicos',
        'Permite asignar responsables de pedidos públicos.'
    ),

    (
        'deliveries.read',
        'deliveries',
        'Consultar domicilios',
        'Permite consultar domicilios.'
    ),
    (
        'deliveries.manage',
        'deliveries',
        'Administrar domicilios',
        'Permite asignar y administrar domicilios.'
    ),
    (
        'deliveries.execute',
        'deliveries',
        'Ejecutar domicilios',
        'Permite actualizar el estado de un domicilio asignado.'
    ),

    (
        'cash.sessions.read',
        'cash',
        'Consultar sesiones de caja',
        'Permite consultar aperturas y cierres de caja.'
    ),
    (
        'cash.sessions.open',
        'cash',
        'Abrir caja',
        'Permite abrir una sesión de caja.'
    ),
    (
        'cash.sessions.close',
        'cash',
        'Cerrar caja',
        'Permite cerrar y arquear una sesión de caja.'
    ),
    (
        'cash.transactions.create',
        'cash',
        'Registrar movimientos de caja',
        'Permite registrar cobros, ingresos y egresos autorizados.'
    ),
    (
        'cash.reports.read',
        'cash',
        'Consultar informes de caja',
        'Permite consultar informes y cierres de caja.'
    )
ON DUPLICATE KEY UPDATE
    module = VALUES(module),
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- ADMIN recibe todos los permisos activos.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
CROSS JOIN permissions AS p
WHERE
    r.code = 'ADMIN'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- INVENTORY_MANAGER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'locations.read',
        'catalog.read',
        'inventory.items.read',
        'inventory.items.manage',
        'inventory.balances.read',
        'inventory.movements.read',
        'inventory.movements.create',
        'inventory.purchases.read',
        'inventory.purchases.create',
        'inventory.transfers.create',
        'inventory.valuation.manage',
        'inventory.reports.read',
        'inventory.reconciliation.read',
        'inventory.reconciliation.execute',
        'inventory.links.manage'
    )
WHERE
    r.code = 'INVENTORY_MANAGER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- PRODUCTION.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'inventory.items.read',
        'inventory.balances.read',
        'production.recipes.read',
        'production.quick.create',
        'production.orders.read',
        'production.orders.execute',
        'production.waste.read',
        'production.waste.create',
        'production.reports.read'
    )
WHERE
    r.code = 'PRODUCTION'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- CASHIER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'catalog.read',
        'tables.read',
        'orders.read',
        'orders.manage',
        'orders.close',
        'cash.sessions.read',
        'cash.sessions.open',
        'cash.sessions.close',
        'cash.transactions.create',
        'cash.reports.read'
    )
WHERE
    r.code = 'CASHIER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- WAITER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'catalog.read',
        'tables.read',
        'orders.read',
        'orders.manage',
        'orders.cancel',
        'orders.close',
        'kitchen.settings.read',
        'kitchen.tickets.read',
        'kitchen.tickets.update',
        'kitchen.tickets.print'
    )
WHERE
    r.code = 'WAITER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- KITCHEN.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'catalog.read',
        'kitchen.dashboard.read',
        'kitchen.settings.read',
        'kitchen.tickets.read',
        'kitchen.tickets.update',
        'kitchen.tickets.print'
    )
WHERE
    r.code = 'KITCHEN'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- PUBLIC_ORDER_MANAGER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'catalog.read',
        'public_orders.read',
        'public_orders.manage',
        'public_orders.assign',
        'deliveries.read',
        'deliveries.manage'
    )
WHERE
    r.code = 'PUBLIC_ORDER_MANAGER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- DELIVERY_DRIVER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'deliveries.read',
        'deliveries.execute'
    )
WHERE
    r.code = 'DELIVERY_DRIVER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

SELECT
    r.code AS role_code,
    p.code AS permission_code,
    p.module
FROM role_permissions AS rp
INNER JOIN roles AS r
    ON r.id = rp.role_id
INNER JOIN permissions AS p
    ON p.id = rp.permission_id
WHERE
    rp.is_active = TRUE
    AND r.is_active = TRUE
    AND p.is_active = TRUE
ORDER BY
    r.code,
    p.module,
    p.code;
