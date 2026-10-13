-- Migración 041:
-- Garantiza que una membresía tenga como máximo una ubicación predeterminada.
--
-- La tabla business_membership_locations fue creada en la migración 040.
-- MySQL permite varios NULL dentro de un índice UNIQUE. Por eso la columna
-- generada solamente contiene un valor cuando is_default es verdadero.

USE sazora_db;

ALTER TABLE business_membership_locations
    ADD COLUMN default_membership_id BIGINT UNSIGNED
        GENERATED ALWAYS AS (
            CASE
                WHEN is_default = TRUE
                THEN business_membership_id
                ELSE NULL
            END
        ) STORED,
    ADD CONSTRAINT uq_membership_locations_single_default
        UNIQUE (
            business_id,
            default_membership_id
        );

SHOW CREATE TABLE business_membership_locations;
