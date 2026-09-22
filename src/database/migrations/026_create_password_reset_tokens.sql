-- Migración 026: tokens para recuperar contraseñas.
--
-- La base de datos almacena únicamente el hash del token.
-- El token original se entrega al usuario y no puede reconstruirse
-- desde la información guardada.

USE sazora_db;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME(3) NOT NULL,
    used_at DATETIME(3) NULL,
    invalidated_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_password_reset_tokens
        PRIMARY KEY (id),

    CONSTRAINT uq_password_reset_tokens_token_hash
        UNIQUE (token_hash),

    CONSTRAINT fk_password_reset_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_password_reset_tokens_user_id (user_id),

    INDEX idx_password_reset_tokens_expires_at (expires_at)
) ENGINE = InnoDB;

DESCRIBE password_reset_tokens;

SHOW CREATE TABLE password_reset_tokens;
