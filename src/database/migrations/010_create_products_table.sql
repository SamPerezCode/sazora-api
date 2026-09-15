-- ? Migración 010: creación de la tabla de productos.
--
-- ? Cada producto pertenece a un negocio, una categoría y un área de
-- preparación del mismo negocio.

USE sazora_db;

CREATE TABLE IF NOT EXISTS products (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    preparation_area_id BIGINT UNSIGNED NOT NULL,
    sku VARCHAR(50) NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NULL,
    current_price DECIMAL(12, 2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_products
        PRIMARY KEY (id),

    CONSTRAINT uq_products_business_product
        UNIQUE (business_id, id),

    CONSTRAINT uq_products_business_sku
        UNIQUE (business_id, sku),

    CONSTRAINT fk_products_category
        FOREIGN KEY (business_id, category_id)
        REFERENCES categories (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_preparation_area
        FOREIGN KEY (business_id, preparation_area_id)
        REFERENCES preparation_areas (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_products_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_products_sku_not_blank
        CHECK (sku IS NULL OR CHAR_LENGTH(TRIM(sku)) > 0),

    CONSTRAINT chk_products_current_price_not_negative
        CHECK (current_price >= 0),

    INDEX idx_products_business_category_active_name (
        business_id,
        category_id,
        is_active,
        name
    ),

    INDEX idx_products_business_area_active (
        business_id,
        preparation_area_id,
        is_active
    )
) ENGINE = InnoDB;

/*
Explicación:

- business_id identifica al negocio propietario del producto.
- category_id organiza el producto dentro del catálogo.
- preparation_area_id determina dónde se prepara y qué zona recibirá
  la comanda.
- sku es un código interno opcional del producto.
- current_price contiene el precio vigente para pedidos nuevos.
- DECIMAL se utiliza para dinero porque evita los errores de precisión
  que podrían producir FLOAT o DOUBLE.
- Un precio de cero está permitido para productos de cortesía.
- El precio histórico se copiará posteriormente en order_items.
- Las llaves foráneas compuestas garantizan que categoría, área y producto
  pertenezcan al mismo negocio.
- uq_products_business_product permitirá aplicar la misma protección
  multiempresa cuando creemos order_items.
- Un producto solo estará disponible si él, su categoría y su área de
  preparación están activos.
- Desactivar una categoría o área no elimina productos ni historial.
*/

DESCRIBE products;

SHOW CREATE TABLE products;

SHOW INDEX FROM products;
