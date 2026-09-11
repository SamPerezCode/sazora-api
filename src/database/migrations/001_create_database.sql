-- Migración 001: creación de la base de datos de Sazora.
-- Debe ejecutarse en MySQL 8 con una cuenta administrativa.
-- Su propósito es crear la base que almacenará los datos de la aplicación.

CREATE DATABASE IF NOT EXISTS sazora_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

/*
¿Qué hace?
- CREATE DATABASE: crea la base.
- IF NOT EXISTS: evita un error si ejecutamos accidentalmente el script otra vez.
- utf8mb4: permite almacenar todo Unicode, incluyendo tildes, símbolos y emojis.
- utf8mb4_0900_ai_ci: configuración moderna de comparación de MySQL 8.
  - ai: no distingue acentos al comparar.
  - ci: no distingue mayúsculas y minúsculas al comparar.
Por ejemplo, en búsquedas de texto:
cafe ≈ café
PAN ≈ pan
*/

-- Comprueba también su configuración:
SELECT
    SCHEMA_NAME,
    DEFAULT_CHARACTER_SET_NAME,
    DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'sazora_db';
-- Resultado esperado:
-- sazora_db | utf8mb4 | utf8mb4_0900_ai_ci


SHOW DATABASES LIKE 'sazora_db';
USE sazora_db;
SHOW TABLES;
-- SHOW TABLES no debe devolver filas porque todavía no hemos creado ninguna tabla.
