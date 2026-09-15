-- ?Migración 004: creación de la tabla de usuarios.
--
-- Cada registro representa la identidad global de una persona.
-- La relación con negocios y roles se creará en migraciones posteriores.

USE sazora_db;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_users
        PRIMARY KEY (id),

    CONSTRAINT uq_users_email
        UNIQUE (email),

    CONSTRAINT chk_users_full_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(full_name)) > 0),

    CONSTRAINT chk_users_email_not_blank
        CHECK (CHAR_LENGTH(TRIM(email)) > 0),

    CONSTRAINT chk_users_password_hash_not_blank
        CHECK (CHAR_LENGTH(TRIM(password_hash)) > 0)
) ENGINE = InnoDB;

/*
Explicación:

- full_name almacena el nombre que mostraremos en la aplicación.
- email será la identidad utilizada durante el inicio de sesión.
- VARCHAR(254) admite la longitud máxima habitual de un correo electrónico.
- password_hash almacenará el hash generado con bcrypt, nunca la contraseña.
- is_active permite bloquear globalmente una cuenta.
- last_login_at comienza en NULL y se actualiza al iniciar sesión.
- UNIQUE impide registrar dos cuentas con el mismo correo.
- La validación completa del formato del correo se realizará con Zod.
*/

DESCRIBE users;

SHOW CREATE TABLE users;

SHOW INDEX FROM users;
