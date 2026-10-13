-- Migración 042: agrega el rol operativo de producción.
--
-- PRODUCTION identifica a los empleados que trabajan en la planta
-- de producción o bodega general.
--
-- Esta migración solamente registra el rol. El acceso operativo
-- por ubicación se implementará posteriormente.

USE sazora_db;

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'PRODUCTION',
    'Producción',
    'Gestiona procesos de producción, productos terminados y operaciones de planta.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'PRODUCTION'
);

SELECT
    id,
    code,
    name,
    description,
    is_active,
    created_at,
    updated_at
FROM roles
WHERE code = 'PRODUCTION';
