-- Migración 025: versión de autenticación de los usuarios.
--
-- Permite invalidar todos los tokens anteriores después de cambiar
-- una contraseña u otra credencial crítica.

USE sazora_db;

ALTER TABLE users
    ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 1
        AFTER password_hash,

    ADD CONSTRAINT chk_users_auth_version_positive
        CHECK (auth_version > 0);

DESCRIBE users;

SELECT
    id,
    email,
    auth_version
FROM users
ORDER BY id;
