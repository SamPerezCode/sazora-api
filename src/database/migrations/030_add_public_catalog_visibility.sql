-- Migración 030: visibilidad y disponibilidad del catálogo público.

USE sazora_db;

ALTER TABLE categories
    ADD COLUMN is_publicly_visible BOOLEAN NOT NULL DEFAULT TRUE
    AFTER is_active;

ALTER TABLE products
    ADD COLUMN is_publicly_visible BOOLEAN NOT NULL DEFAULT TRUE
    AFTER is_active,
    ADD COLUMN is_publicly_orderable BOOLEAN NOT NULL DEFAULT TRUE
    AFTER is_publicly_visible;

CREATE INDEX idx_categories_public_menu
    ON categories (
        business_id,
        is_active,
        is_publicly_visible,
        display_order
    );

CREATE INDEX idx_products_public_menu
    ON products (
        business_id,
        category_id,
        is_active,
        is_publicly_visible,
        is_publicly_orderable
    );

SHOW CREATE TABLE categories;

SHOW CREATE TABLE products;
