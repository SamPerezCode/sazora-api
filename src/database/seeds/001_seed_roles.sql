-- ?Seed 001: roles iniciales de Sazora.
--
-- ? Un seed agrega datos necesarios para que la aplicación pueda funcionar.
-- Las comprobaciones NOT EXISTS permiten ejecutar el archivo nuevamente
-- sin duplicar los roles.

USE sazora_db;

INSERT INTO roles (code, name, description)
SELECT
    'ADMIN',
    'Administrador',
    'Administra la configuración y las operaciones del negocio.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'ADMIN'
);

INSERT INTO roles (code, name, description)
SELECT
    'WAITER',
    'Mesero',
    'Gestiona mesas, órdenes, adiciones y entregas.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'WAITER'
);

INSERT INTO roles (code, name, description)
SELECT
    'KITCHEN',
    'Cocina',
    'Consulta comandas y actualiza el estado de preparación.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'KITCHEN'
);

-- Verifica los datos iniciales.

SELECT
    id,
    code,
    name,
    description,
    is_active
FROM roles
ORDER BY id;
