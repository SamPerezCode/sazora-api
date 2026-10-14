-- Migración 043:
-- Asigna las áreas de preparación del catálogo a una o varias ubicaciones.
--
-- preparation_areas continúa representando la definición operativa:
-- Cocina, Barra, Panadería, Jugos, etc.
--
-- preparation_area_locations indica en cuáles sedes o plantas funciona
-- cada área.

USE sazora_db;

CREATE TABLE IF NOT EXISTS preparation_area_locations (
    business_id BIGINT UNSIGNED NOT NULL,
    preparation_area_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_preparation_area_locations
        PRIMARY KEY (
            business_id,
            preparation_area_id,
            location_id
        ),

    CONSTRAINT fk_preparation_area_locations_area
        FOREIGN KEY (
            business_id,
            preparation_area_id
        )
        REFERENCES preparation_areas (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_preparation_area_locations_location
        FOREIGN KEY (
            business_id,
            location_id
        )
        REFERENCES business_locations (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_preparation_area_locations_location (
        business_id,
        location_id,
        preparation_area_id
    )
) ENGINE = InnoDB;

-- Conserva la operación actual:
-- las áreas existentes quedan disponibles inicialmente en todas las
-- ubicaciones activas del mismo negocio.
--
-- Después, el administrador podrá corregir las asignaciones desde
-- Configuración > Áreas de preparación.
INSERT IGNORE INTO preparation_area_locations (
    business_id,
    preparation_area_id,
    location_id
)
SELECT
    pa.business_id,
    pa.id,
    bl.id
FROM preparation_areas AS pa
INNER JOIN business_locations AS bl
    ON bl.business_id = pa.business_id
    AND bl.is_active = TRUE;

SHOW CREATE TABLE preparation_area_locations;
SHOW INDEX FROM preparation_area_locations;
