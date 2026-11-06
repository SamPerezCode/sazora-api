-- ==============================================================
-- ARCHIVO: 001_create_database.sql
-- ==============================================================

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


-- ==============================================================
-- ARCHIVO: 002_create_businesses_table.sql
-- ==============================================================

-- ?Migración 002: creación de la tabla de negocios.
--
-- *Cada registro representa un restaurante, cafetería, panadería u otro
-- establecimiento independiente que utiliza Sazora.

USE sazora_db;

-- ! businesses representa a cada negocio independiente que utiliza Sazora.
CREATE TABLE IF NOT EXISTS businesses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
    currency_code CHAR(3) NOT NULL DEFAULT 'COP',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_businesses
        PRIMARY KEY (id),

    CONSTRAINT uq_businesses_slug
        UNIQUE (slug),

    CONSTRAINT chk_businesses_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_businesses_slug_not_blank
        CHECK (CHAR_LENGTH(TRIM(slug)) > 0)
) ENGINE = InnoDB;

/*
Explicación:

- BIGINT UNSIGNED permite identificadores positivos de gran capacidad.
- AUTO_INCREMENT genera automáticamente el siguiente identificador.
- VARCHAR establece una longitud máxima sin rellenar espacios.
- slug identifica el negocio de forma legible y debe ser único.
- CHAR(3) almacena códigos de moneda como COP, USD o EUR.
- BOOLEAN representa un valor verdadero o falso. MySQL lo almacena
  internamente como TINYINT.
- DATETIME(3) conserva fecha, hora y milisegundos.
- CURRENT_TIMESTAMP(3) genera automáticamente la fecha actual.
- ON UPDATE actualiza updated_at cuando cambia el registro.
- CHECK impide guardar nombres o slugs vacíos.
- InnoDB permite llaves foráneas y transacciones.
*/

-- Verificaciones manuales. Estas consultas no modifican información.

DESCRIBE businesses;

SHOW CREATE TABLE businesses;

SHOW INDEX FROM businesses;


-- ==============================================================
-- ARCHIVO: 003_create_roles_table.sql
-- ==============================================================

-- ?Migración 003: creación de la tabla de roles.
--
-- *Los roles definen las funciones que una persona puede desempeñar.
-- Son globales; posteriormente se asignarán dentro de cada negocio.

USE sazora_db;

CREATE TABLE IF NOT EXISTS roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_roles
        PRIMARY KEY (id),

    CONSTRAINT uq_roles_code
        UNIQUE (code),

    CONSTRAINT chk_roles_code_not_blank
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_roles_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0)
) ENGINE = InnoDB;

/*
Explicación:

- code es el identificador estable utilizado por el backend.
- name es el nombre que puede mostrarse a las personas.
- description explica la responsabilidad general del rol.
- is_active permite desactivar un rol sin eliminar sus asignaciones históricas.
- code es único para impedir roles duplicados.
*/

DESCRIBE roles;

SHOW CREATE TABLE roles;

SHOW INDEX FROM roles;


-- ==============================================================
-- ARCHIVO: 004_create_users_table.sql
-- ==============================================================

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


-- ==============================================================
-- ARCHIVO: 005_create_business_memberships_table.sql
-- ==============================================================

-- ?Migración 005: pertenencias de usuarios a negocios.
--
-- *Esta tabla permite que un usuario pertenezca a uno o varios negocios.
-- Los roles se asignarán mediante otra tabla en la siguiente migración.

USE sazora_db;

CREATE TABLE IF NOT EXISTS business_memberships (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_memberships
        PRIMARY KEY (id),

    CONSTRAINT uq_business_memberships_business_user
        UNIQUE (business_id, user_id),

    CONSTRAINT fk_business_memberships_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_business_memberships_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_business_memberships_user_id (user_id)
) ENGINE = InnoDB;

/*
Explicación:

- business_id identifica el negocio.
- user_id identifica la persona.
- La combinación UNIQUE impide relacionar dos veces al mismo usuario
  con el mismo negocio.
- is_active permite bloquear al usuario en un negocio sin bloquear su
  identidad global ni afectar sus otras pertenencias.
- ON DELETE RESTRICT impide eliminar negocios o usuarios relacionados.
- El índice de user_id acelera la búsqueda de los negocios de un usuario.
- No contiene role_id porque una pertenencia podrá tener varios roles.
*/

DESCRIBE business_memberships;

SHOW CREATE TABLE business_memberships;

SHOW INDEX FROM business_memberships;


-- ==============================================================
-- ARCHIVO: 006_create_business_membership_roles_table.sql
-- ==============================================================

-- ?Migración 006: asignación de roles a las pertenencias.
--
-- *Permite que una persona tenga varios roles dentro del mismo negocio.
-- Ejemplo: una persona puede ser ADMIN y WAITER simultáneamente.

USE sazora_db;

CREATE TABLE IF NOT EXISTS business_membership_roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_membership_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_membership_roles
        PRIMARY KEY (id),

    CONSTRAINT uq_business_membership_roles_membership_role
        UNIQUE (business_membership_id, role_id),

    CONSTRAINT fk_business_membership_roles_membership
        FOREIGN KEY (business_membership_id)
        REFERENCES business_memberships (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_business_membership_roles_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_business_membership_roles_role_id (role_id)
) ENGINE = InnoDB;

/*
Explicación:

- business_membership_id identifica la pertenencia del usuario al negocio.
- role_id identifica el rol asignado.
- La restricción UNIQUE impide asignar dos veces el mismo rol.
- is_active permite retirar y posteriormente restaurar un rol sin eliminar
  físicamente la asignación.
- No guardamos business_id aquí porque ya se obtiene desde la pertenencia.
- ON DELETE RESTRICT protege el historial de asignaciones.
- El backend comprobará que el rol esté activo antes de asignarlo.
*/

DESCRIBE business_membership_roles;
SHOW CREATE TABLE business_membership_roles;
SHOW INDEX FROM business_membership_roles;


-- ==============================================================
-- ARCHIVO: 007_create_categories_table.sql
-- ==============================================================

-- ?Migración 007: creación de la tabla de categorías.
--
-- ?Cada categoría pertenece a un negocio y permite organizar su catálogo.
-- Ejemplos: Panadería, Bebidas, Desayunos y Postres.

USE sazora_db;

CREATE TABLE IF NOT EXISTS categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_categories
        PRIMARY KEY (id),

    CONSTRAINT uq_categories_business_name
        UNIQUE (business_id, name),

    CONSTRAINT fk_categories_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_categories_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_categories_business_active_order (
        business_id,
        is_active,
        display_order
    )
) ENGINE = InnoDB;

/*
Explicación:

- business_id identifica al negocio propietario de la categoría.
- name contiene el nombre mostrado en el catálogo.
- description es opcional.
- display_order permite controlar el orden mostrado en la interfaz.
- is_active permite ocultar la categoría sin eliminar su historial.
- UNIQUE (business_id, name) evita repetir un nombre dentro del mismo negocio.
- Dos negocios diferentes sí pueden tener categorías con el mismo nombre.
- ON DELETE RESTRICT impide eliminar un negocio que tenga categorías.
- El índice compuesto facilita consultar las categorías activas de un negocio
  en el orden configurado.
- Si una categoría está inactiva, sus productos no estarán disponibles para
  órdenes nuevas, aunque los productos conserven su propio estado.
*/

DESCRIBE categories;

SHOW CREATE TABLE categories;

SHOW INDEX FROM categories;


-- ==============================================================
-- ARCHIVO: 008_create_preparation_areas_table.sql
-- ==============================================================

-- ? Migración 008: creación de las áreas de preparación.
--
-- ? Cada área representa una zona operativa que recibe productos.
-- Ejemplos: Cocina, Jugos, Bar, Panadería y Postres.

USE sazora_db;

CREATE TABLE IF NOT EXISTS preparation_areas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_preparation_areas
        PRIMARY KEY (id),

    CONSTRAINT uq_preparation_areas_business_name
        UNIQUE (business_id, name),

    CONSTRAINT fk_preparation_areas_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_preparation_areas_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_preparation_areas_business_active_order (
        business_id,
        is_active,
        display_order
    )
) ENGINE = InnoDB;

/*
Explicación:

- business_id identifica al negocio propietario del área.
- name contiene nombres como Cocina, Jugos o Bar.
- description permite explicar qué productos prepara la zona.
- display_order controla su posición en pantallas administrativas.
- is_active permite desactivar el área sin eliminar su historial.
- El nombre solo debe ser único dentro del mismo negocio.
- Categorías y áreas son independientes.
- Los productos se relacionarán posteriormente con preparation_areas.
- Las impresoras no se configuran todavía porque la impresión automática está
  fuera del MVP. En el futuro, esa configuración pertenecerá al área.
- ON DELETE RESTRICT impide eliminar un negocio que tenga áreas relacionadas.
*/

DESCRIBE preparation_areas;
SHOW CREATE TABLE preparation_areas;
SHOW INDEX FROM preparation_areas;


-- ==============================================================
-- ARCHIVO: 009_add_catalog_tenant_keys.sql
-- ==============================================================

-- ? Migración 009: llaves compuestas para proteger el catálogo multiempresa.
--
-- ? Estas llaves permitirán comprobar que productos, categorías y áreas
-- pertenezcan siempre al mismo negocio.

USE sazora_db;

ALTER TABLE categories
    ADD CONSTRAINT uq_categories_business_category
        UNIQUE (business_id, id);

ALTER TABLE preparation_areas
    ADD CONSTRAINT uq_preparation_areas_business_area
        UNIQUE (business_id, id);

/*
Explicación:

- id ya es único globalmente en cada tabla.
- Estas llaves compuestas también declaran como única la combinación entre
  el negocio y el registro.
- products podrá usar llaves foráneas compuestas:
    (business_id, category_id) -> categories (business_id, id)
    (business_id, preparation_area_id)
        -> preparation_areas (business_id, id)
- Así MySQL rechazará relaciones entre negocios diferentes aunque exista
  un error en el backend.
- Los índices son parcialmente redundantes, pero están justificados por la
  protección estricta del aislamiento multiempresa.
*/

SHOW INDEX FROM categories;
SHOW INDEX FROM preparation_areas;


-- ==============================================================
-- ARCHIVO: 010_create_products_table.sql
-- ==============================================================

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


-- ==============================================================
-- ARCHIVO: 011_create_restaurant_tables.sql
-- ==============================================================

-- ? Migración 011: creación de la tabla de mesas del restaurante.
--
-- ? Cada mesa pertenece a un negocio y tiene un código único dentro de él.

USE sazora_db;

CREATE TABLE IF NOT EXISTS restaurant_tables (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(80) NOT NULL,
    capacity SMALLINT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_restaurant_tables
        PRIMARY KEY (id),

    CONSTRAINT uq_restaurant_tables_business_table
        UNIQUE (business_id, id),

    CONSTRAINT uq_restaurant_tables_business_code
        UNIQUE (business_id, code),

    CONSTRAINT fk_restaurant_tables_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_restaurant_tables_code_not_blank
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_restaurant_tables_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_restaurant_tables_capacity_positive
        CHECK (capacity IS NULL OR capacity > 0),

    INDEX idx_restaurant_tables_business_active_name (
        business_id,
        is_active,
        name
    )
) ENGINE = InnoDB;

/*
Explicación:

- business_id identifica al negocio propietario de la mesa.
- code es el identificador operativo de la mesa, por ejemplo MESA-01.
- name es el nombre que verá el personal, por ejemplo Mesa 1 o Terraza 3.
- capacity indica opcionalmente cuántas personas puede recibir la mesa.
- El código no puede repetirse dentro del mismo negocio, pero dos negocios
  diferentes sí pueden utilizar el mismo código.
- is_active permite retirar una mesa del servicio sin eliminar su historial.
- No se almacena un campo como is_occupied. La ocupación se calculará a partir
  de los pedidos activos asociados con la mesa, evitando estados contradictorios.
- uq_restaurant_tables_business_table permitirá que orders utilice una llave
  foránea compuesta y garantice que el pedido y la mesa sean del mismo negocio.
- ON DELETE RESTRICT protege las mesas y su historial cuando un negocio tiene
  información relacionada.
*/

DESCRIBE restaurant_tables;

SHOW CREATE TABLE restaurant_tables;

SHOW INDEX FROM restaurant_tables;


-- ==============================================================
-- ARCHIVO: 012_add_membership_tenant_key.sql
-- ==============================================================

-- ? Migración 012: llave compuesta para proteger las operaciones multiempresa.
--
-- ? Esta llave permitirá comprobar que el empleado y la orden pertenezcan
-- al mismo negocio.

USE sazora_db;

ALTER TABLE business_memberships
    ADD CONSTRAINT uq_business_memberships_business_membership
        UNIQUE (business_id, id);

/*
Explicación:

- id ya identifica globalmente una pertenencia.
- La combinación (business_id, id) también declara explícitamente a qué
  negocio pertenece esa relación.
- Las tablas operativas podrán utilizar una llave foránea compuesta para
  impedir que una operación de un negocio sea registrada por una pertenencia
  correspondiente a otro negocio.
- Esta migración debe ejecutarse una sola vez. Si se repite, MySQL informará
  que el nombre de la llave ya existe.
*/

SHOW INDEX FROM business_memberships;


-- ==============================================================
-- ARCHIVO: 013_create_orders_table.sql
-- ==============================================================

-- ? Migración 013: creación de la tabla de órdenes.
--
-- ? Una orden representa el pedido completo y puede originarse en una mesa
-- o directamente en el mostrador.

USE sazora_db;

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    restaurant_table_id BIGINT UNSIGNED NULL,
    opened_by_membership_id BIGINT UNSIGNED NOT NULL,
    service_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    customer_count SMALLINT UNSIGNED NULL,
    notes VARCHAR(500) NULL,
    confirmed_at DATETIME(3) NULL,
    delivered_at DATETIME(3) NULL,
    closed_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_orders
        PRIMARY KEY (id),

    CONSTRAINT uq_orders_business_order
        UNIQUE (business_id, id),

    CONSTRAINT fk_orders_table
        FOREIGN KEY (business_id, restaurant_table_id)
        REFERENCES restaurant_tables (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_orders_opened_by_membership
        FOREIGN KEY (business_id, opened_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_orders_service_type
        CHECK (service_type IN ('TABLE', 'COUNTER')),

    CONSTRAINT chk_orders_table_matches_service
        CHECK (
            (service_type = 'TABLE' AND restaurant_table_id IS NOT NULL)
            OR
            (service_type = 'COUNTER' AND restaurant_table_id IS NULL)
        ),

    CONSTRAINT chk_orders_status
        CHECK (
            status IN (
                'OPEN',
                'CONFIRMED',
                'DELIVERED',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_orders_customer_count_positive
        CHECK (customer_count IS NULL OR customer_count > 0),

    CONSTRAINT chk_orders_notes_not_blank
        CHECK (notes IS NULL OR CHAR_LENGTH(TRIM(notes)) > 0),

    INDEX idx_orders_business_status_created (
        business_id,
        status,
        created_at
    ),

    INDEX idx_orders_business_table_status (
        business_id,
        restaurant_table_id,
        status
    ),

    INDEX idx_orders_business_membership_created (
        business_id,
        opened_by_membership_id,
        created_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- id identifica la orden y será también su número inicial visible en el MVP.
- business_id identifica el negocio propietario de la orden.
- opened_by_membership_id identifica al empleado que abrió el pedido dentro
  de ese negocio.
- service_type diferencia pedidos atendidos en mesa de pedidos de mostrador.
- restaurant_table_id es obligatorio para TABLE y debe ser NULL para COUNTER.
- La llave foránea compuesta impide asociar una mesa de otro negocio.
- status representa el estado general confirmado para el MVP: OPEN,
  CONFIRMED, DELIVERED, CLOSED o CANCELLED.
- Las fechas de estado facilitan consultas operativas e informes. El historial
  detallado de transiciones se almacenará en order_status_history.
- customer_count es opcional y, cuando se suministra, debe ser mayor que cero.
- No se almacenan totales todavía. Se calcularán con los elementos activos y
  sus precios históricos para evitar inconsistencias durante esta etapa.
- La ocupación de una mesa se obtendrá buscando órdenes activas asociadas con
  ella. Por eso restaurant_tables no necesita un campo is_occupied.
- Los índices facilitan consultar órdenes por estado, mesa y empleado.
*/

DESCRIBE orders;

SHOW CREATE TABLE orders;

SHOW INDEX FROM orders;


-- ==============================================================
-- ARCHIVO: 014_create_order_items_table.sql
-- ==============================================================

-- ? Migración 014: creación de la tabla de elementos de una orden.
--
-- ? Cada fila representa un producto agregado a un pedido, con la información
-- comercial y operativa que tenía en ese momento.

USE sazora_db;

CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    preparation_area_id BIGINT UNSIGNED NOT NULL,
    added_by_membership_id BIGINT UNSIGNED NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    notes VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    cancelled_by_membership_id BIGINT UNSIGNED NULL,
    cancellation_reason VARCHAR(500) NULL,
    cancelled_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_items
        PRIMARY KEY (id),

    CONSTRAINT uq_order_items_business_order_item
        UNIQUE (business_id, id),

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (business_id, order_id)
        REFERENCES orders (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (business_id, product_id)
        REFERENCES products (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_preparation_area
        FOREIGN KEY (business_id, preparation_area_id)
        REFERENCES preparation_areas (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_added_by_membership
        FOREIGN KEY (business_id, added_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_items_cancelled_by_membership
        FOREIGN KEY (business_id, cancelled_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_items_product_name_not_blank
        CHECK (CHAR_LENGTH(TRIM(product_name)) > 0),

    CONSTRAINT chk_order_items_quantity_positive
        CHECK (quantity > 0),

    CONSTRAINT chk_order_items_unit_price_not_negative
        CHECK (unit_price >= 0),

    CONSTRAINT chk_order_items_notes_not_blank
        CHECK (notes IS NULL OR CHAR_LENGTH(TRIM(notes)) > 0),

    CONSTRAINT chk_order_items_status
        CHECK (status IN ('ACTIVE', 'CANCELLED')),

    CONSTRAINT chk_order_items_cancellation_data
        CHECK (
            (
                status = 'ACTIVE'
                AND cancelled_by_membership_id IS NULL
                AND cancellation_reason IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                status = 'CANCELLED'
                AND cancelled_by_membership_id IS NOT NULL
                AND cancellation_reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(cancellation_reason)) > 0
                AND cancelled_at IS NOT NULL
            )
        ),

    INDEX idx_order_items_business_order_status_created (
        business_id,
        order_id,
        status,
        created_at
    ),

    INDEX idx_order_items_business_area_status (
        business_id,
        preparation_area_id,
        status
    ),

    INDEX idx_order_items_business_product (
        business_id,
        product_id
    ),

    INDEX idx_order_items_business_added_by (
        business_id,
        added_by_membership_id
    ),

    INDEX idx_order_items_business_cancelled_by (
        business_id,
        cancelled_by_membership_id
    )
) ENGINE = InnoDB;

/*
Explicación:

- order_id identifica el pedido al cual pertenece el elemento.
- product_id conserva la relación con el producto original del catálogo.
- product_name copia el nombre vigente cuando se agrega el producto. Así, un
  cambio posterior en el catálogo no altera pedidos, recibos ni comandas.
- preparation_area_id copia la ruta de preparación vigente en ese momento.
  Si el producto cambia de área después, el pedido existente conserva su ruta.
- unit_price copia products.current_price desde el backend. El frontend nunca
  debe decidir ni enviar como confiable el precio definitivo.
- quantity debe ser mayor que cero. Llevar una cantidad a cero se tratará como
  una cancelación, no como una cantidad válida.
- Los elementos ACTIVE participan en los totales; los CANCELLED se excluyen.
- Un elemento cancelado no se elimina después de confirmar la orden. Conserva
  quién lo canceló, cuándo ocurrió y la razón obligatoria.
- Mientras la orden permanezca en OPEN, el backend podrá eliminar físicamente
  un elemento que todavía no haya sido enviado a preparación.
- added_by_membership_id y cancelled_by_membership_id permiten auditar las
  acciones realizadas por el personal.
- Todas las llaves foráneas compuestas impiden mezclar información entre
  negocios distintos.
- Una adición posterior a la confirmación se guardará como una nueva fila, aun
  cuando ya exista otra fila del mismo producto dentro del pedido.
- Los cambios de cantidad, notas y cancelación se registrarán posteriormente
  en order_item_changes.
*/

DESCRIBE order_items;

SHOW CREATE TABLE order_items;

SHOW INDEX FROM order_items;


-- ==============================================================
-- ARCHIVO: 015_create_order_item_changes_table.sql
-- ==============================================================

-- ? Migración 015: creación del historial de cambios de elementos de órdenes.
--
-- ? Cada fila registra un evento ocurrido sobre un producto del pedido.
-- Este historial es acumulativo: sus registros no deben editarse ni eliminarse.

USE sazora_db;

CREATE TABLE IF NOT EXISTS order_item_changes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    change_type VARCHAR(30) NOT NULL,
    previous_quantity SMALLINT UNSIGNED NULL,
    new_quantity SMALLINT UNSIGNED NULL,
    previous_notes VARCHAR(500) NULL,
    new_notes VARCHAR(500) NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_item_changes
        PRIMARY KEY (id),

    CONSTRAINT fk_order_item_changes_order_item
        FOREIGN KEY (business_id, order_item_id)
        REFERENCES order_items (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_item_changes_membership
        FOREIGN KEY (business_id, changed_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_item_changes_type
        CHECK (
            change_type IN (
                'ADDED',
                'QUANTITY_INCREASED',
                'QUANTITY_DECREASED',
                'NOTES_CHANGED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_order_item_changes_notes_not_blank
        CHECK (
            (previous_notes IS NULL OR CHAR_LENGTH(TRIM(previous_notes)) > 0)
            AND
            (new_notes IS NULL OR CHAR_LENGTH(TRIM(new_notes)) > 0)
        ),

    CONSTRAINT chk_order_item_changes_reason_not_blank
        CHECK (reason IS NULL OR CHAR_LENGTH(TRIM(reason)) > 0),

    CONSTRAINT chk_order_item_changes_event_data
        CHECK (
            (
                change_type = 'ADDED'
                AND previous_quantity IS NULL
                AND new_quantity IS NOT NULL
                AND new_quantity > 0
                AND previous_notes IS NULL
                AND reason IS NULL
            )
            OR
            (
                change_type = 'QUANTITY_INCREASED'
                AND previous_quantity IS NOT NULL
                AND new_quantity IS NOT NULL
                AND previous_quantity > 0
                AND new_quantity > previous_quantity
                AND previous_notes IS NULL
                AND new_notes IS NULL
                AND reason IS NULL
            )
            OR
            (
                change_type = 'QUANTITY_DECREASED'
                AND previous_quantity IS NOT NULL
                AND new_quantity IS NOT NULL
                AND new_quantity > 0
                AND new_quantity < previous_quantity
                AND previous_notes IS NULL
                AND new_notes IS NULL
                AND reason IS NULL
            )
            OR
            (
                change_type = 'NOTES_CHANGED'
                AND previous_quantity IS NULL
                AND new_quantity IS NULL
                AND NOT (previous_notes <=> new_notes)
                AND reason IS NULL
            )
            OR
            (
                change_type = 'CANCELLED'
                AND previous_quantity IS NOT NULL
                AND previous_quantity > 0
                AND new_quantity IS NULL
                AND previous_notes IS NULL
                AND new_notes IS NULL
                AND reason IS NOT NULL
            )
        ),

    INDEX idx_order_item_changes_business_item_created (
        business_id,
        order_item_id,
        created_at
    ),

    INDEX idx_order_item_changes_business_member_created (
        business_id,
        changed_by_membership_id,
        created_at
    ),

    INDEX idx_order_item_changes_business_type_created (
        business_id,
        change_type,
        created_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- order_item_id identifica el producto del pedido que fue modificado.
- changed_by_membership_id identifica al empleado que realizó la acción.
- change_type admite ADDED, QUANTITY_INCREASED, QUANTITY_DECREASED,
  NOTES_CHANGED y CANCELLED.
- previous_quantity y new_quantity permiten reconstruir cambios de cantidad.
- previous_notes y new_notes permiten reconstruir cambios de observaciones.
- reason es obligatorio únicamente para CANCELLED.
- ADDED conserva la cantidad inicial y, cuando existe, la observación inicial.
- CANCELLED conserva la cantidad que fue cancelada y su razón.
- Las restricciones validan que cada tipo de evento contenga únicamente los
  datos que le corresponden.
- El operador <=> compara valores de forma segura cuando alguno es NULL. Así se
  puede registrar tanto la creación como la eliminación de una observación.
- La tabla no tiene updated_at porque un evento histórico nunca debe editarse.
- Las modificaciones del elemento y la inserción de su evento deberán ocurrir
  dentro de una misma transacción para que ambos cambios sean inseparables.
- Esta tabla no representa comandas nuevas. Los eventos determinarán qué áreas
  deben recibir una versión actualizada o una reimpresión de la misma comanda.
*/

DESCRIBE order_item_changes;

SHOW CREATE TABLE order_item_changes;

SHOW INDEX FROM order_item_changes;


-- ==============================================================
-- ARCHIVO: 016_create_order_status_history_table.sql
-- ==============================================================

-- ? Migración 016: creación del historial de estados de las órdenes.
--
-- ? Cada fila registra una transición de estado. Este historial es acumulativo
-- y sus registros no deben editarse ni eliminarse.

USE sazora_db;

CREATE TABLE IF NOT EXISTS order_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_order_status_history
        PRIMARY KEY (id),

    CONSTRAINT fk_order_status_history_order
        FOREIGN KEY (business_id, order_id)
        REFERENCES orders (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_order_status_history_membership
        FOREIGN KEY (business_id, changed_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_order_status_history_previous_status
        CHECK (
            previous_status IS NULL
            OR previous_status IN (
                'OPEN',
                'CONFIRMED',
                'DELIVERED',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_order_status_history_new_status
        CHECK (
            new_status IN (
                'OPEN',
                'CONFIRMED',
                'DELIVERED',
                'CLOSED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_order_status_history_transition
        CHECK (
            (previous_status IS NULL AND new_status = 'OPEN')
            OR
            (
                previous_status IS NOT NULL
                AND previous_status <> new_status
            )
        ),

    CONSTRAINT chk_order_status_history_reason
        CHECK (
            (
                new_status = 'CANCELLED'
                AND reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(reason)) > 0
            )
            OR
            (
                new_status <> 'CANCELLED'
                AND (reason IS NULL OR CHAR_LENGTH(TRIM(reason)) > 0)
            )
        ),

    INDEX idx_order_status_history_business_order_created (
        business_id,
        order_id,
        created_at
    ),

    INDEX idx_order_status_history_business_status_created (
        business_id,
        new_status,
        created_at
    ),

    INDEX idx_order_status_history_business_member_created (
        business_id,
        changed_by_membership_id,
        created_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- order_id identifica la orden cuyo estado cambió.
- changed_by_membership_id identifica al empleado responsable del cambio.
- previous_status conserva el estado anterior y es NULL únicamente en el evento
  inicial que registra la creación de la orden en OPEN.
- new_status conserva el estado al cual pasó la orden.
- Los estados admitidos coinciden con orders: OPEN, CONFIRMED, DELIVERED,
  CLOSED y CANCELLED.
- Una cancelación exige una razón. Para otros cambios, la razón es opcional,
  pero no puede contener solamente espacios.
- La restricción de transición impide registrar un cambio hacia el mismo estado.
- Las reglas específicas de transición, como OPEN -> CONFIRMED o
  DELIVERED -> CONFIRMED después de una adición, se validarán en el backend.
  Esto permite evolucionar el flujo sin tener que alterar esta tabla.
- La modificación de orders y la inserción del historial deberán realizarse
  dentro de la misma transacción.
- La tabla no tiene updated_at porque los eventos históricos son inmutables.
- Los índices facilitan reconstruir la historia de una orden y consultar cambios
  por estado o por empleado.
*/

DESCRIBE order_status_history;

SHOW CREATE TABLE order_status_history;

SHOW INDEX FROM order_status_history;


-- ==============================================================
-- ARCHIVO: 017_create_kitchen_tickets_table.sql
-- ==============================================================

-- ? Migración 017: creación de las comandas por área de preparación.
--
-- ? Cada orden tendrá como máximo una comanda lógica por cada área involucrada.
-- Las modificaciones actualizarán su versión sin crear otra comanda equivalente.

USE sazora_db;

CREATE TABLE IF NOT EXISTS kitchen_tickets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    preparation_area_id BIGINT UNSIGNED NOT NULL,
    created_by_membership_id BIGINT UNSIGNED NOT NULL,
    last_modified_by_membership_id BIGINT UNSIGNED NOT NULL,
    current_version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_kitchen_tickets
        PRIMARY KEY (id),

    CONSTRAINT uq_kitchen_tickets_business_ticket
        UNIQUE (business_id, id),

    CONSTRAINT uq_kitchen_tickets_business_order_area
        UNIQUE (business_id, order_id, preparation_area_id),

    CONSTRAINT fk_kitchen_tickets_order
        FOREIGN KEY (business_id, order_id)
        REFERENCES orders (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_tickets_preparation_area
        FOREIGN KEY (business_id, preparation_area_id)
        REFERENCES preparation_areas (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_tickets_created_by_membership
        FOREIGN KEY (business_id, created_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_tickets_modified_by_membership
        FOREIGN KEY (business_id, last_modified_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_kitchen_tickets_current_version_positive
        CHECK (current_version > 0),

    INDEX idx_kitchen_tickets_business_area_updated (
        business_id,
        preparation_area_id,
        updated_at
    ),

    INDEX idx_kitchen_tickets_business_creator (
        business_id,
        created_by_membership_id
    ),

    INDEX idx_kitchen_tickets_business_modifier (
        business_id,
        last_modified_by_membership_id
    )
) ENGINE = InnoDB;

/*
Explicación:

- order_id identifica el pedido compartido por todas sus comandas.
- preparation_area_id determina qué zona recibe la comanda, por ejemplo Cocina,
  Jugos o Bar.
- La combinación UNIQUE (business_id, order_id, preparation_area_id) garantiza
  que exista una sola comanda lógica por orden y área de preparación.
- Dos comandas de áreas diferentes pueden compartir la misma orden y mesa.
- current_version comienza en 1 y aumenta cuando cambia el contenido enviado a
  esa área. Editar una comanda no crea otra con un número distinto.
- Una adición en un área existente incrementará la versión de esa comanda. Si la
  orden incorpora por primera vez otra área, se creará su comanda en versión 1.
- created_by_membership_id identifica quién generó la primera versión.
- last_modified_by_membership_id identifica quién realizó el cambio más reciente.
  Al crear la comanda, ambos campos tendrán la misma pertenencia.
- El estado general de la comanda no se almacena aquí: se calculará utilizando
  los estados de sus elementos para evitar información contradictoria.
- Las impresiones y reimpresiones se registrarán en kitchen_ticket_prints con la
  versión correspondiente.
- Las llaves foráneas compuestas impiden relacionar órdenes, áreas y empleados
  pertenecientes a negocios diferentes.
- El incremento de versión, los cambios de elementos y el registro de impresión
  deberán ejecutarse dentro de una transacción.
*/

DESCRIBE kitchen_tickets;

SHOW CREATE TABLE kitchen_tickets;

SHOW INDEX FROM kitchen_tickets;


-- ==============================================================
-- ARCHIVO: 018_add_kitchen_item_context_keys.sql
-- ==============================================================

-- ? Migración 018: llaves de contexto para los elementos de las comandas.
--
-- ? Estas llaves permitirán comprobar que la comanda y el producto enviado
-- pertenezcan al mismo negocio, la misma orden y la misma área de preparación.

USE sazora_db;

ALTER TABLE order_items
    ADD CONSTRAINT uq_order_items_business_item_order_area
        UNIQUE (
            business_id,
            id,
            order_id,
            preparation_area_id
        );

ALTER TABLE kitchen_tickets
    ADD CONSTRAINT uq_kitchen_tickets_business_ticket_order_area
        UNIQUE (
            business_id,
            id,
            order_id,
            preparation_area_id
        );

/*
Explicación:

- order_items ya conoce su negocio, orden y área de preparación.
- kitchen_tickets también conoce su negocio, orden y área de preparación.
- Las llaves compuestas permitirán que kitchen_ticket_items relacione ambas
  tablas utilizando todo ese contexto.
- MySQL rechazará un producto si se intenta colocar en una comanda de otra
  orden, otra área o un negocio diferente.
- Estas migraciones ALTER deben ejecutarse una sola vez. Si se repiten, MySQL
  informará que los nombres de las llaves ya existen.
*/

SHOW INDEX FROM order_items;

SHOW INDEX FROM kitchen_tickets;


-- ==============================================================
-- ARCHIVO: 019_create_kitchen_ticket_items_table.sql
-- ==============================================================

-- ? Migración 019: creación de los elementos de las comandas.
--
-- ? Cada fila conecta un producto de la orden con la comanda de su área y
-- conserva su estado actual de preparación.

USE sazora_db;

CREATE TABLE IF NOT EXISTS kitchen_ticket_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    kitchen_ticket_id BIGINT UNSIGNED NOT NULL,
    order_item_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    preparation_area_id BIGINT UNSIGNED NOT NULL,
    preparation_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    last_changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    started_at DATETIME(3) NULL,
    ready_at DATETIME(3) NULL,
    delivered_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_kitchen_ticket_items
        PRIMARY KEY (id),

    CONSTRAINT uq_kitchen_ticket_items_business_item
        UNIQUE (business_id, id),

    CONSTRAINT uq_kitchen_ticket_items_business_order_item
        UNIQUE (business_id, order_item_id),

    CONSTRAINT fk_kitchen_ticket_items_ticket_context
        FOREIGN KEY (
            business_id,
            kitchen_ticket_id,
            order_id,
            preparation_area_id
        )
        REFERENCES kitchen_tickets (
            business_id,
            id,
            order_id,
            preparation_area_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_ticket_items_order_item_context
        FOREIGN KEY (
            business_id,
            order_item_id,
            order_id,
            preparation_area_id
        )
        REFERENCES order_items (
            business_id,
            id,
            order_id,
            preparation_area_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_ticket_items_membership
        FOREIGN KEY (business_id, last_changed_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_kitchen_ticket_items_status
        CHECK (
            preparation_status IN (
                'PENDING',
                'IN_PREPARATION',
                'READY',
                'DELIVERED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_kitchen_ticket_items_status_dates
        CHECK (
            (
                preparation_status = 'PENDING'
                AND started_at IS NULL
                AND ready_at IS NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'IN_PREPARATION'
                AND started_at IS NOT NULL
                AND ready_at IS NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'READY'
                AND started_at IS NOT NULL
                AND ready_at IS NOT NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'DELIVERED'
                AND started_at IS NOT NULL
                AND ready_at IS NOT NULL
                AND delivered_at IS NOT NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'CANCELLED'
                AND delivered_at IS NULL
                AND cancelled_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_kitchen_ticket_items_date_order
        CHECK (
            (ready_at IS NULL OR ready_at >= started_at)
            AND
            (delivered_at IS NULL OR delivered_at >= ready_at)
        ),

    INDEX idx_kitchen_ticket_items_ticket_context (
        business_id,
        kitchen_ticket_id,
        order_id,
        preparation_area_id
    ),

    INDEX idx_kitchen_ticket_items_order_item_context (
        business_id,
        order_item_id,
        order_id,
        preparation_area_id
    ),

    INDEX idx_kitchen_ticket_items_business_membership (
        business_id,
        last_changed_by_membership_id
    ),

    INDEX idx_kitchen_ticket_items_business_ticket_status (
        business_id,
        kitchen_ticket_id,
        preparation_status,
        created_at
    ),

    INDEX idx_kitchen_ticket_items_business_area_status (
        business_id,
        preparation_area_id,
        preparation_status,
        updated_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- kitchen_ticket_id identifica la comanda que recibe el producto.
- order_item_id identifica el elemento original del pedido.
- order_id y preparation_area_id se conservan para que las llaves foráneas
  comprueben todo el contexto operativo, no para duplicar decisiones del negocio.
- Un order_item solo puede aparecer una vez en las comandas. Como cada producto
  tiene una única área en el MVP, no debe enviarse simultáneamente a dos zonas.
- preparation_status admite PENDING, IN_PREPARATION, READY, DELIVERED y CANCELLED.
- started_at, ready_at, delivered_at y cancelled_at conservan los momentos
  principales del proceso de preparación.
- Las restricciones comprueban que las fechas correspondan con el estado actual
  y que READY o DELIVERED no ocurran antes de sus estados anteriores.
- Un producto cancelado puede haber estado pendiente, en preparación o listo,
  pero no puede aparecer simultáneamente como entregado.
- last_changed_by_membership_id identifica quién realizó el último cambio.
- El historial completo de estados se almacenará en
  kitchen_item_status_history; esta tabla conserva únicamente el estado actual.
- El estado general de una comanda se calculará a partir de todos sus elementos.
- Todos los cambios de estado y sus registros históricos deberán ejecutarse en
  una misma transacción.
*/

DESCRIBE kitchen_ticket_items;

SHOW CREATE TABLE kitchen_ticket_items;

SHOW INDEX FROM kitchen_ticket_items;


-- ==============================================================
-- ARCHIVO: 020_create_kitchen_item_status_history_table.sql
-- ==============================================================

-- ? Migración 020: creación del historial de preparación de las comandas.
--
-- ? Cada fila registra una transición de estado de un producto enviado a un
-- área de preparación. Los eventos son inmutables.

USE sazora_db;

CREATE TABLE IF NOT EXISTS kitchen_item_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    kitchen_ticket_item_id BIGINT UNSIGNED NOT NULL,
    changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_kitchen_item_status_history
        PRIMARY KEY (id),

    CONSTRAINT fk_kitchen_item_status_history_item
        FOREIGN KEY (business_id, kitchen_ticket_item_id)
        REFERENCES kitchen_ticket_items (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_item_status_history_membership
        FOREIGN KEY (business_id, changed_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_kitchen_item_status_history_previous_status
        CHECK (
            previous_status IS NULL
            OR previous_status IN (
                'PENDING',
                'IN_PREPARATION',
                'READY',
                'DELIVERED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_kitchen_item_status_history_new_status
        CHECK (
            new_status IN (
                'PENDING',
                'IN_PREPARATION',
                'READY',
                'DELIVERED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_kitchen_item_status_history_transition
        CHECK (
            (previous_status IS NULL AND new_status = 'PENDING')
            OR
            (
                previous_status IS NOT NULL
                AND previous_status <> new_status
            )
        ),

    CONSTRAINT chk_kitchen_item_status_history_reason
        CHECK (
            (
                new_status = 'CANCELLED'
                AND reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(reason)) > 0
            )
            OR
            (
                new_status <> 'CANCELLED'
                AND (reason IS NULL OR CHAR_LENGTH(TRIM(reason)) > 0)
            )
        ),

    INDEX idx_kitchen_item_history_business_item_created (
        business_id,
        kitchen_ticket_item_id,
        created_at
    ),

    INDEX idx_kitchen_item_history_business_status_created (
        business_id,
        new_status,
        created_at
    ),

    INDEX idx_kitchen_item_history_business_member_created (
        business_id,
        changed_by_membership_id,
        created_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- kitchen_ticket_item_id identifica el producto de la comanda cuyo estado cambió.
- changed_by_membership_id identifica al empleado que realizó la transición.
- previous_status es NULL únicamente en el evento inicial que registra PENDING.
- new_status conserva el nuevo estado de preparación.
- Los estados coinciden con kitchen_ticket_items: PENDING, IN_PREPARATION,
  READY, DELIVERED y CANCELLED.
- Una cancelación exige una razón. Para las demás transiciones es opcional, pero
  nunca puede contener solamente espacios.
- La base de datos impide registrar una transición hacia el mismo estado.
- Las transiciones específicas permitidas, como PENDING -> IN_PREPARATION o
  READY -> DELIVERED, se validarán en el backend.
- kitchen_ticket_items y su evento histórico deberán actualizarse dentro de una
  misma transacción.
- Esta tabla no tiene updated_at porque un evento histórico nunca debe editarse.
- El historial permitirá medir tiempos de preparación y determinar quién realizó
  cada cambio sin depender únicamente del estado actual.
*/

DESCRIBE kitchen_item_status_history;

SHOW CREATE TABLE kitchen_item_status_history;

SHOW INDEX FROM kitchen_item_status_history;


-- ==============================================================
-- ARCHIVO: 021_create_kitchen_ticket_prints_table.sql
-- ==============================================================

-- ? Migración 021: creación del historial de impresiones de comandas.
--
-- ? Cada fila representa una impresión o reimpresión de una versión específica
-- y conserva una copia exacta del contenido enviado a imprimir.

USE sazora_db;

CREATE TABLE IF NOT EXISTS kitchen_ticket_prints (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    kitchen_ticket_id BIGINT UNSIGNED NOT NULL,
    printed_by_membership_id BIGINT UNSIGNED NOT NULL,
    ticket_version INT UNSIGNED NOT NULL,
    print_type VARCHAR(20) NOT NULL,
    reason VARCHAR(500) NULL,
    printer_name VARCHAR(150) NULL,
    content_snapshot JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_kitchen_ticket_prints
        PRIMARY KEY (id),

    CONSTRAINT fk_kitchen_ticket_prints_ticket
        FOREIGN KEY (business_id, kitchen_ticket_id)
        REFERENCES kitchen_tickets (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_kitchen_ticket_prints_membership
        FOREIGN KEY (business_id, printed_by_membership_id)
        REFERENCES business_memberships (business_id, id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_kitchen_ticket_prints_version_positive
        CHECK (ticket_version > 0),

    CONSTRAINT chk_kitchen_ticket_prints_type
        CHECK (print_type IN ('INITIAL', 'MODIFICATION', 'REPRINT')),

    CONSTRAINT chk_kitchen_ticket_prints_reason
        CHECK (
            (
                print_type = 'INITIAL'
                AND ticket_version = 1
                AND reason IS NULL
            )
            OR
            (
                print_type = 'MODIFICATION'
                AND ticket_version > 1
                AND reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(reason)) > 0
            )
            OR
            (
                print_type = 'REPRINT'
                AND reason IS NOT NULL
                AND CHAR_LENGTH(TRIM(reason)) > 0
            )
        ),

    CONSTRAINT chk_kitchen_ticket_prints_printer_name_not_blank
        CHECK (
            printer_name IS NULL
            OR CHAR_LENGTH(TRIM(printer_name)) > 0
        ),

    INDEX idx_kitchen_ticket_prints_business_ticket_version (
        business_id,
        kitchen_ticket_id,
        ticket_version,
        created_at
    ),

    INDEX idx_kitchen_ticket_prints_business_member_created (
        business_id,
        printed_by_membership_id,
        created_at
    ),

    INDEX idx_kitchen_ticket_prints_business_type_created (
        business_id,
        print_type,
        created_at
    )
) ENGINE = InnoDB;

/*
Explicación:

- kitchen_ticket_id identifica la comanda lógica que fue impresa.
- ticket_version conserva la versión exacta del contenido impreso.
- print_type admite INITIAL, MODIFICATION y REPRINT.
- INITIAL representa el primer envío de la versión 1 y no requiere una razón.
- MODIFICATION representa la impresión de una nueva versión después de cambios
  como adiciones, cancelaciones, cantidades u observaciones. Exige una razón o
  resumen que permita reconocer la modificación.
- REPRINT vuelve a imprimir una versión sin incrementarla y exige indicar el
  motivo, por ejemplo daño o pérdida de la impresión anterior.
- printed_by_membership_id identifica a la persona que solicitó la impresión.
- printer_name permite guardar opcionalmente el destino utilizado. Será útil
  cuando se implemente la impresión térmica automática.
- content_snapshot es construido por el backend y almacena en JSON los datos
  exactos enviados a imprimir: orden, mesa, área, versión, productos y notas.
- La copia JSON impide que cambios posteriores en la orden o el catálogo alteren
  la evidencia de lo que recibió el área de preparación.
- Una reimpresión debe utilizar la copia de la versión solicitada y conservar el
  mismo número de orden, mesa y comanda.
- El backend validará que ticket_version exista y no supere current_version.
- La tabla no tiene updated_at porque cada impresión es un evento inmutable.
- Si en el futuro se controlan intentos fallidos de impresión, se podrá ampliar
  este modelo con estados técnicos sin cambiar el significado del historial.
*/

DESCRIBE kitchen_ticket_prints;

SHOW CREATE TABLE kitchen_ticket_prints;

SHOW INDEX FROM kitchen_ticket_prints;


-- ==============================================================
-- ARCHIVO: 022_add_catalog_images.sql
-- ==============================================================

-- Migración 022: referencias de imágenes para el catálogo.
--
-- Cada categoría y producto podrá tener una imagen opcional.
-- MySQL almacenará únicamente la referencia del archivo, no la imagen binaria.

USE sazora_db;

ALTER TABLE categories
    ADD COLUMN image_url VARCHAR(2048) NULL
        AFTER description,

    ADD CONSTRAINT chk_categories_image_url_not_blank
        CHECK (
            image_url IS NULL
            OR CHAR_LENGTH(TRIM(image_url)) > 0
        );

ALTER TABLE products
    ADD COLUMN image_url VARCHAR(2048) NULL
        AFTER description,

    ADD CONSTRAINT chk_products_image_url_not_blank
        CHECK (
            image_url IS NULL
            OR CHAR_LENGTH(TRIM(image_url)) > 0
        );

/*
Explicación:

- image_url es opcional.
- La columna contendrá la referencia pública o relativa de la imagen.
- No se guardarán archivos binarios ni imágenes Base64 en MySQL.
- VARCHAR(2048) permite almacenar rutas locales o direcciones de proveedores
  de almacenamiento externos.
- El CHECK impide guardar una cadena vacía o compuesta solo por espacios.
- Una categoría y un producto tendrán una sola imagen principal.
- Reemplazar una imagen actualizará esta referencia.
- Retirar una imagen establecerá image_url en NULL.
*/

DESCRIBE categories;
DESCRIBE products;

SHOW CREATE TABLE categories;
SHOW CREATE TABLE products;


-- ==============================================================
-- ARCHIVO: 023_expand_order_service_types.sql
-- ==============================================================

-- Migración 023: ampliación de las modalidades de servicio.
--
-- TABLE representa consumo en una mesa física.
-- TAKEAWAY representa pedidos realizados para llevar.
-- DELIVERY representa pedidos para entrega a domicilio.

USE sazora_db;

ALTER TABLE orders
    DROP CHECK chk_orders_table_matches_service;

ALTER TABLE orders
    DROP CHECK chk_orders_service_type;

-- Convierte cualquier dato anterior de mostrador a la nueva modalidad.
UPDATE orders
SET service_type = 'TAKEAWAY'
WHERE id > 0
    AND service_type = 'COUNTER';

ALTER TABLE orders
    ADD CONSTRAINT chk_orders_service_type
        CHECK (
            service_type IN (
                'TABLE',
                'TAKEAWAY',
                'DELIVERY'
            )
        ),

    ADD CONSTRAINT chk_orders_table_matches_service
        CHECK (
            (
                service_type = 'TABLE'
                AND restaurant_table_id IS NOT NULL
            )
            OR
            (
                service_type IN ('TAKEAWAY', 'DELIVERY')
                AND restaurant_table_id IS NULL
            )
        );

/*
Explicación:

- Solamente TABLE requiere una mesa física.
- TAKEAWAY y DELIVERY no ocupan una mesa.
- Una mesa física solo puede tener una orden activa.
- Ventanilla y domicilios pueden acumular varias órdenes activas.
- La modalidad de servicio no representa el origen del pedido.
- El origen POS, WEB o integración externa se añadirá por separado.
*/

SELECT
    id,
    service_type,
    restaurant_table_id,
    status
FROM orders
ORDER BY id;

SHOW CREATE TABLE orders;


-- ==============================================================
-- ARCHIVO: 024_add_product_fulfillment_mode.sql
-- ==============================================================

-- Migración 024: modo de preparación y entrega de los productos.
--
-- PREPARE_TO_ORDER:
-- El producto debe prepararse después de confirmar la orden.
--
-- READY_TO_SERVE:
-- El producto ya está preparado y solamente debe despacharse.

USE sazora_db;

ALTER TABLE products
    ADD COLUMN fulfillment_mode VARCHAR(30)
        NOT NULL
        DEFAULT 'PREPARE_TO_ORDER'
        AFTER preparation_area_id,

    ADD CONSTRAINT chk_products_fulfillment_mode
        CHECK (
            fulfillment_mode IN (
                'PREPARE_TO_ORDER',
                'READY_TO_SERVE'
            )
        );

ALTER TABLE order_items
    ADD COLUMN fulfillment_mode VARCHAR(30)
        NOT NULL
        DEFAULT 'PREPARE_TO_ORDER'
        AFTER preparation_area_id,

    ADD CONSTRAINT chk_order_items_fulfillment_mode
        CHECK (
            fulfillment_mode IN (
                'PREPARE_TO_ORDER',
                'READY_TO_SERVE'
            )
        );

-- Los productos READY_TO_SERVE podrán comenzar directamente en READY.
ALTER TABLE kitchen_ticket_items
    DROP CHECK chk_kitchen_ticket_items_status_dates,
    DROP CHECK chk_kitchen_ticket_items_date_order;

ALTER TABLE kitchen_ticket_items
    ADD CONSTRAINT chk_kitchen_ticket_items_status_dates
        CHECK (
            (
                preparation_status = 'PENDING'
                AND started_at IS NULL
                AND ready_at IS NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'IN_PREPARATION'
                AND started_at IS NOT NULL
                AND ready_at IS NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'READY'
                AND ready_at IS NOT NULL
                AND delivered_at IS NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'DELIVERED'
                AND ready_at IS NOT NULL
                AND delivered_at IS NOT NULL
                AND cancelled_at IS NULL
            )
            OR
            (
                preparation_status = 'CANCELLED'
                AND delivered_at IS NULL
                AND cancelled_at IS NOT NULL
            )
        ),

    ADD CONSTRAINT chk_kitchen_ticket_items_date_order
        CHECK (
            (
                started_at IS NULL
                OR ready_at IS NULL
                OR ready_at >= started_at
            )
            AND
            (
                ready_at IS NULL
                OR delivered_at IS NULL
                OR delivered_at >= ready_at
            )
        );

-- El primer evento histórico podrá ser PENDING o READY.
ALTER TABLE kitchen_item_status_history
    DROP CHECK chk_kitchen_item_status_history_transition;

ALTER TABLE kitchen_item_status_history
    ADD CONSTRAINT chk_kitchen_item_status_history_transition
        CHECK (
            (
                previous_status IS NULL
                AND new_status IN ('PENDING', 'READY')
            )
            OR
            (
                previous_status IS NOT NULL
                AND previous_status <> new_status
            )
        );

DESCRIBE products;
DESCRIBE order_items;
SHOW CREATE TABLE kitchen_ticket_items;
SHOW CREATE TABLE kitchen_item_status_history;




-- Ver productos
SELECT
    id,
    name,
    preparation_area_id,
    fulfillment_mode
FROM products
WHERE business_id = 1
ORDER BY id;

-- Actualizar producto con el id 1
UPDATE products
SET fulfillment_mode = 'READY_TO_SERVE'
WHERE business_id = 1
  AND id = 1;


-- ==============================================================
-- ARCHIVO: 025_add_user_auth_version.sql
-- ==============================================================

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


-- ==============================================================
-- ARCHIVO: 026_create_password_reset_tokens.sql
-- ==============================================================

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


-- ==============================================================
-- ARCHIVO: 027_create_business_settings_table.sql
-- ==============================================================

-- Migración 027: configuración administrativa y pública de cada negocio.

USE sazora_db;

CREATE TABLE IF NOT EXISTS business_settings (
    business_id BIGINT UNSIGNED NOT NULL,
    tagline VARCHAR(160) NULL,
    phone VARCHAR(30) NULL,
    address VARCHAR(250) NULL,
    opening_hours_text VARCHAR(200) NULL,
    instagram VARCHAR(100) NULL,
    tax_id VARCHAR(50) NULL,
    logo_url VARCHAR(500) NULL,
    primary_color CHAR(7) NOT NULL DEFAULT '#1F4534',
    accent_color CHAR(7) NOT NULL DEFAULT '#C2703C',
    kitchen_ticket_footer VARCHAR(500) NULL,
    public_menu_description VARCHAR(500) NULL,
    public_menu_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    public_ordering_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_settings
        PRIMARY KEY (business_id),

    CONSTRAINT fk_business_settings_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_business_settings_tagline
        CHECK (
            tagline IS NULL
            OR CHAR_LENGTH(TRIM(tagline)) > 0
        ),

    CONSTRAINT chk_business_settings_phone
        CHECK (
            phone IS NULL
            OR CHAR_LENGTH(TRIM(phone)) > 0
        ),

    CONSTRAINT chk_business_settings_address
        CHECK (
            address IS NULL
            OR CHAR_LENGTH(TRIM(address)) > 0
        ),

    CONSTRAINT chk_business_settings_opening_hours
        CHECK (
            opening_hours_text IS NULL
            OR CHAR_LENGTH(TRIM(opening_hours_text)) > 0
        ),

    CONSTRAINT chk_business_settings_instagram
        CHECK (
            instagram IS NULL
            OR CHAR_LENGTH(TRIM(instagram)) > 0
        ),

    CONSTRAINT chk_business_settings_tax_id
        CHECK (
            tax_id IS NULL
            OR CHAR_LENGTH(TRIM(tax_id)) > 0
        ),

    CONSTRAINT chk_business_settings_logo_url
        CHECK (
            logo_url IS NULL
            OR CHAR_LENGTH(TRIM(logo_url)) > 0
        ),

    CONSTRAINT chk_business_settings_primary_color
        CHECK (
            primary_color REGEXP '^#[0-9A-Fa-f]{6}$'
        ),

    CONSTRAINT chk_business_settings_accent_color
        CHECK (
            accent_color REGEXP '^#[0-9A-Fa-f]{6}$'
        ),

    CONSTRAINT chk_business_settings_ticket_footer
        CHECK (
            kitchen_ticket_footer IS NULL
            OR CHAR_LENGTH(TRIM(kitchen_ticket_footer)) > 0
        ),

    CONSTRAINT chk_business_settings_menu_description
        CHECK (
            public_menu_description IS NULL
            OR CHAR_LENGTH(TRIM(public_menu_description)) > 0
        ),

    CONSTRAINT chk_business_settings_ordering_requires_menu
        CHECK (
            public_ordering_enabled = FALSE
            OR public_menu_enabled = TRUE
        )
) ENGINE = InnoDB;

INSERT IGNORE INTO business_settings (
    business_id,
    kitchen_ticket_footer
)
SELECT
    id,
    'Gracias por tu trabajo en cocina'
FROM businesses;

DESCRIBE business_settings;

SHOW CREATE TABLE business_settings;


-- ==============================================================
-- ARCHIVO: 028_create_public_order_assignments_table.sql
-- ==============================================================

-- Migración 028: responsables programados para pedidos públicos y domicilios.

USE sazora_db;

CREATE TABLE IF NOT EXISTS public_order_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    assigned_membership_id BIGINT UNSIGNED NOT NULL,
    channel ENUM(
        'PUBLIC_ORDER',
        'DELIVERY'
    ) NOT NULL,
    specific_date DATE NULL,
    day_of_week TINYINT UNSIGNED NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    priority SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_membership_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_assignments
        PRIMARY KEY (id),

    CONSTRAINT fk_public_order_assignments_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_assignments_assignee
        FOREIGN KEY (
            business_id,
            assigned_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_assignments_creator
        FOREIGN KEY (
            business_id,
            created_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_public_order_assignments_schedule_type
        CHECK (
            (
                specific_date IS NOT NULL
                AND day_of_week IS NULL
            )
            OR
            (
                specific_date IS NULL
                AND day_of_week IS NOT NULL
            )
        ),

    CONSTRAINT chk_public_order_assignments_day
        CHECK (
            day_of_week IS NULL
            OR day_of_week BETWEEN 0 AND 6
        ),

    CONSTRAINT chk_public_order_assignments_time
        CHECK (start_time < end_time),

    CONSTRAINT chk_public_order_assignments_priority
        CHECK (priority <= 100),

    INDEX idx_public_order_assignments_lookup (
        business_id,
        channel,
        is_active,
        specific_date,
        day_of_week,
        start_time,
        end_time,
        priority
    ),

    INDEX idx_public_order_assignments_membership (
        business_id,
        assigned_membership_id,
        is_active
    )
) ENGINE = InnoDB;

DESCRIBE public_order_assignments;

SHOW CREATE TABLE public_order_assignments;

SHOW INDEX FROM public_order_assignments;


-- ==============================================================
-- ARCHIVO: 029_add_public_order_manager_role.sql
-- ==============================================================

-- Migración 029:
-- Agrega el rol de gestor de pedidos públicos y permite responsables
-- permanentes o programados.

USE sazora_db;

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'PUBLIC_ORDER_MANAGER',
    'Gestor de pedidos públicos',
    'Gestiona solicitudes creadas desde el menú público.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'PUBLIC_ORDER_MANAGER'
);

ALTER TABLE public_order_assignments
    DROP CHECK chk_public_order_assignments_schedule_type;

ALTER TABLE public_order_assignments
    DROP CHECK chk_public_order_assignments_time;

ALTER TABLE public_order_assignments
    DROP INDEX idx_public_order_assignments_lookup;

ALTER TABLE public_order_assignments
    ADD COLUMN service_scope ENUM(
        'ALL',
        'DELIVERY',
        'TAKEAWAY'
    ) NOT NULL DEFAULT 'ALL'
    AFTER assigned_membership_id;

ALTER TABLE public_order_assignments
    DROP COLUMN channel;

ALTER TABLE public_order_assignments
    MODIFY COLUMN start_time TIME NULL,
    MODIFY COLUMN end_time TIME NULL;

ALTER TABLE public_order_assignments
    ADD CONSTRAINT chk_public_order_assignments_schedule
        CHECK (
            (
                specific_date IS NULL
                AND day_of_week IS NULL
                AND start_time IS NULL
                AND end_time IS NULL
            )
            OR
            (
                specific_date IS NULL
                AND day_of_week IS NOT NULL
                AND start_time IS NOT NULL
                AND end_time IS NOT NULL
                AND start_time < end_time
            )
            OR
            (
                specific_date IS NOT NULL
                AND day_of_week IS NULL
                AND start_time IS NOT NULL
                AND end_time IS NOT NULL
                AND start_time < end_time
            )
        );

CREATE INDEX idx_public_order_assignments_lookup
    ON public_order_assignments (
        business_id,
        service_scope,
        is_active,
        specific_date,
        day_of_week,
        start_time,
        end_time,
        priority
    );

SELECT
    id,
    code,
    name,
    description,
    is_active
FROM roles
WHERE code = 'PUBLIC_ORDER_MANAGER';

SHOW CREATE TABLE public_order_assignments;


-- ==============================================================
-- ARCHIVO: 030_add_public_catalog_visibility.sql
-- ==============================================================

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


-- ==============================================================
-- ARCHIVO: 031_create_public_order_requests.sql
-- ==============================================================

-- Migración 031: solicitudes creadas desde el menú público.

USE sazora_db;

CREATE TABLE IF NOT EXISTS public_order_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_code CHAR(36) NOT NULL,
    business_id BIGINT UNSIGNED NOT NULL,
    service_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    customer_name VARCHAR(150) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    customer_email VARCHAR(254) NULL,
    delivery_address VARCHAR(300) NULL,
    notes VARCHAR(500) NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    handled_by_membership_id BIGINT UNSIGNED NULL,
    order_id BIGINT UNSIGNED NULL,
    contacted_at DATETIME(3) NULL,
    accepted_at DATETIME(3) NULL,
    rejected_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    rejection_reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_requests
        PRIMARY KEY (id),

    CONSTRAINT uq_public_order_requests_public_code
        UNIQUE (public_code),

    CONSTRAINT uq_public_order_requests_business_request
        UNIQUE (business_id, id),

    CONSTRAINT fk_public_order_requests_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_requests_handler
        FOREIGN KEY (
            business_id,
            handled_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_requests_order
        FOREIGN KEY (
            business_id,
            order_id
        )
        REFERENCES orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_public_order_requests_service_type
        CHECK (service_type IN ('DELIVERY', 'TAKEAWAY')),

    CONSTRAINT chk_public_order_requests_status
        CHECK (
            status IN (
                'NEW',
                'CONTACTED',
                'ACCEPTED',
                'REJECTED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_public_order_requests_customer_name
        CHECK (CHAR_LENGTH(TRIM(customer_name)) > 0),

    CONSTRAINT chk_public_order_requests_customer_phone
        CHECK (CHAR_LENGTH(TRIM(customer_phone)) > 0),

    CONSTRAINT chk_public_order_requests_delivery_address
        CHECK (
            (
                service_type = 'DELIVERY'
                AND delivery_address IS NOT NULL
                AND CHAR_LENGTH(TRIM(delivery_address)) > 0
            )
            OR
            (
                service_type = 'TAKEAWAY'
                AND delivery_address IS NULL
            )
        ),

    CONSTRAINT chk_public_order_requests_subtotal
        CHECK (subtotal >= 0),

    INDEX idx_public_order_requests_business_status_created (
        business_id,
        status,
        created_at
    ),

    INDEX idx_public_order_requests_business_handler (
        business_id,
        handled_by_membership_id,
        status
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS public_order_request_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    public_order_request_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity SMALLINT UNSIGNED NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    notes VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_request_items
        PRIMARY KEY (id),

    CONSTRAINT fk_public_order_request_items_request
        FOREIGN KEY (
            business_id,
            public_order_request_id
        )
        REFERENCES public_order_requests (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_request_items_product
        FOREIGN KEY (
            business_id,
            product_id
        )
        REFERENCES products (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT uq_public_order_request_items_product
        UNIQUE (
            public_order_request_id,
            product_id
        ),

    CONSTRAINT chk_public_order_request_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_public_order_request_items_price
        CHECK (
            unit_price >= 0
            AND line_total >= 0
        ),

    INDEX idx_public_order_request_items_request (
        business_id,
        public_order_request_id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE public_order_requests;

SHOW CREATE TABLE public_order_request_items;


-- ==============================================================
-- ARCHIVO: 032_create_public_order_deliveries.sql
-- ==============================================================

-- Migración 032: gestión de domicilios de solicitudes públicas.

USE sazora_db;

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'DELIVERY_DRIVER',
    'Domiciliario',
    'Recibe, transporta y entrega pedidos a domicilio.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'DELIVERY_DRIVER'
);

CREATE TABLE IF NOT EXISTS public_order_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    public_order_request_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    assigned_driver_membership_id BIGINT UNSIGNED NULL,
    assigned_by_membership_id BIGINT UNSIGNED NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    assigned_at DATETIME(3) NULL,
    picked_up_at DATETIME(3) NULL,
    out_for_delivery_at DATETIME(3) NULL,
    delivered_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_deliveries
        PRIMARY KEY (id),

    CONSTRAINT uq_public_order_deliveries_business_delivery
        UNIQUE (business_id, id),

    CONSTRAINT uq_public_order_deliveries_request
        UNIQUE (public_order_request_id),

    CONSTRAINT uq_public_order_deliveries_order
        UNIQUE (order_id),

    CONSTRAINT fk_public_order_deliveries_request
        FOREIGN KEY (
            business_id,
            public_order_request_id
        )
        REFERENCES public_order_requests (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_deliveries_order
        FOREIGN KEY (
            business_id,
            order_id
        )
        REFERENCES orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_deliveries_driver
        FOREIGN KEY (
            business_id,
            assigned_driver_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_deliveries_assigner
        FOREIGN KEY (
            business_id,
            assigned_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_public_order_deliveries_status
        CHECK (
            status IN (
                'PENDING_ASSIGNMENT',
                'ASSIGNED',
                'PICKED_UP',
                'OUT_FOR_DELIVERY',
                'DELIVERED',
                'CANCELLED'
            )
        ),

    INDEX idx_public_order_deliveries_business_status (
        business_id,
        status,
        created_at
    ),

    INDEX idx_public_order_deliveries_driver_status (
        business_id,
        assigned_driver_membership_id,
        status,
        created_at
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS public_order_delivery_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    delivery_id BIGINT UNSIGNED NOT NULL,
    changed_by_membership_id BIGINT UNSIGNED NOT NULL,
    previous_status VARCHAR(30) NULL,
    new_status VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_public_order_delivery_status_history
        PRIMARY KEY (id),

    CONSTRAINT fk_public_order_delivery_history_delivery
        FOREIGN KEY (
            business_id,
            delivery_id
        )
        REFERENCES public_order_deliveries (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_public_order_delivery_history_membership
        FOREIGN KEY (
            business_id,
            changed_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_public_order_delivery_history_delivery (
        business_id,
        delivery_id,
        created_at
    )
) ENGINE = InnoDB;

-- Recupera solicitudes DELIVERY aceptadas antes de esta migración.

INSERT INTO public_order_deliveries (
    business_id,
    public_order_request_id,
    order_id,
    status,
    delivered_at
)
SELECT
    por.business_id,
    por.id,
    por.order_id,
    CASE
        WHEN o.status IN ('DELIVERED', 'CLOSED')
            THEN 'DELIVERED'
        ELSE 'PENDING_ASSIGNMENT'
    END,
    CASE
        WHEN o.status IN ('DELIVERED', 'CLOSED')
            THEN o.delivered_at
        ELSE NULL
    END
FROM public_order_requests AS por
INNER JOIN orders AS o
    ON o.business_id = por.business_id
    AND o.id = por.order_id
WHERE
    por.service_type = 'DELIVERY'
    AND por.status = 'ACCEPTED'
    AND por.order_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM public_order_deliveries AS existing_delivery
        WHERE existing_delivery.public_order_request_id = por.id
    );

SELECT
    id,
    code,
    name
FROM roles
WHERE code = 'DELIVERY_DRIVER';

SHOW CREATE TABLE public_order_deliveries;
SHOW CREATE TABLE public_order_delivery_status_history;


-- ==============================================================
-- ARCHIVO: 033_add_delivery_mode.sql
-- ==============================================================

-- Migración 033: entrega interna o mediante proveedor externo.

USE sazora_db;

ALTER TABLE public_order_deliveries
    ADD COLUMN delivery_mode VARCHAR(20) NULL
        AFTER order_id,
    ADD COLUMN external_provider_name VARCHAR(150) NULL
        AFTER assigned_driver_membership_id;

-- Las asignaciones existentes corresponden a empleados internos.

UPDATE public_order_deliveries
SET delivery_mode = 'INTERNAL'
WHERE assigned_driver_membership_id IS NOT NULL;

ALTER TABLE public_order_deliveries
    ADD CONSTRAINT chk_public_order_deliveries_mode
        CHECK (
            (
                delivery_mode IS NULL
                AND assigned_driver_membership_id IS NULL
                AND external_provider_name IS NULL
            )
            OR
            (
                delivery_mode = 'INTERNAL'
                AND assigned_driver_membership_id IS NOT NULL
                AND external_provider_name IS NULL
            )
            OR
            (
                delivery_mode = 'EXTERNAL'
                AND assigned_driver_membership_id IS NULL
            )
        );

SHOW CREATE TABLE public_order_deliveries;


-- ==============================================================
-- ARCHIVO: 034_create_inventory_core.sql
-- ==============================================================

-- Migración 034: núcleo de inventario y libro de movimientos.

USE sazora_db;

CREATE TABLE IF NOT EXISTS inventory_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    sku VARCHAR(50) NULL,
    name VARCHAR(150) NOT NULL,
    item_type VARCHAR(30) NOT NULL,
    base_unit VARCHAR(30) NOT NULL,
    current_stock DECIMAL(18, 3) NOT NULL DEFAULT 0.000,
    minimum_stock DECIMAL(18, 3) NOT NULL DEFAULT 0.000,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_items
        PRIMARY KEY (id),

    CONSTRAINT uq_inventory_items_business_item
        UNIQUE (business_id, id),

    CONSTRAINT uq_inventory_items_business_sku
        UNIQUE (business_id, sku),

    CONSTRAINT fk_inventory_items_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_items_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_inventory_items_sku
        CHECK (
            sku IS NULL
            OR CHAR_LENGTH(TRIM(sku)) > 0
        ),

    CONSTRAINT chk_inventory_items_type
        CHECK (
            item_type IN (
                'RAW_MATERIAL',
                'SEMI_FINISHED',
                'FINISHED_GOOD',
                'RESALE_GOOD'
            )
        ),

    CONSTRAINT chk_inventory_items_unit
        CHECK (
            base_unit IN (
                'UNIT',
                'GRAM',
                'KILOGRAM',
                'MILLILITER',
                'LITER',
                'PORTION',
                'PACKAGE'
            )
        ),

    CONSTRAINT chk_inventory_items_stock
        CHECK (
            current_stock >= 0
            AND minimum_stock >= 0
        ),

    INDEX idx_inventory_items_business_active_name (
        business_id,
        is_active,
        name
    ),

    INDEX idx_inventory_items_business_type (
        business_id,
        item_type,
        is_active
    ),

    INDEX idx_inventory_items_business_stock (
        business_id,
        current_stock,
        minimum_stock
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS inventory_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    movement_type VARCHAR(30) NOT NULL,
    source_type VARCHAR(30) NULL,
    source_id VARCHAR(100) NULL,
    notes VARCHAR(500) NULL,
    created_by_membership_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_movements
        PRIMARY KEY (id),

    CONSTRAINT uq_inventory_movements_business_movement
        UNIQUE (business_id, id),

    CONSTRAINT uq_inventory_movements_source
        UNIQUE (
            business_id,
            source_type,
            source_id
        ),

    CONSTRAINT fk_inventory_movements_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_movements_membership
        FOREIGN KEY (
            business_id,
            created_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_movements_type
        CHECK (
            movement_type IN (
                'OPENING',
                'PURCHASE',
                'PRODUCTION',
                'SALE',
                'ADJUSTMENT',
                'WASTE',
                'RETURN',
                'REVERSAL'
            )
        ),

    CONSTRAINT chk_inventory_movements_source
        CHECK (
            (
                source_type IS NULL
                AND source_id IS NULL
            )
            OR
            (
                source_type IS NOT NULL
                AND source_id IS NOT NULL
            )
        ),

    INDEX idx_inventory_movements_business_created (
        business_id,
        created_at
    ),

    INDEX idx_inventory_movements_business_type_created (
        business_id,
        movement_type,
        created_at
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS inventory_movement_lines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    movement_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,
    direction VARCHAR(10) NOT NULL,
    quantity DECIMAL(18, 3) NOT NULL,
    balance_before DECIMAL(18, 3) NOT NULL,
    balance_after DECIMAL(18, 3) NOT NULL,
    notes VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_movement_lines
        PRIMARY KEY (id),

    CONSTRAINT fk_inventory_movement_lines_movement
        FOREIGN KEY (
            business_id,
            movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_movement_lines_item
        FOREIGN KEY (
            business_id,
            inventory_item_id
        )
        REFERENCES inventory_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_movement_lines_direction
        CHECK (direction IN ('IN', 'OUT')),

    CONSTRAINT chk_inventory_movement_lines_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_inventory_movement_lines_balances
        CHECK (
            balance_before >= 0
            AND balance_after >= 0
        ),

    INDEX idx_inventory_movement_lines_item_created (
        business_id,
        inventory_item_id,
        created_at
    ),

    INDEX idx_inventory_movement_lines_movement (
        business_id,
        movement_id,
        id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE inventory_items;
SHOW CREATE TABLE inventory_movements;
SHOW CREATE TABLE inventory_movement_lines;


-- ==============================================================
-- ARCHIVO: 035_create_product_inventory_links.sql
-- ==============================================================

-- Migración 035: relación entre productos de venta e inventario.

USE sazora_db;

CREATE TABLE IF NOT EXISTS product_inventory_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,
    quantity_per_product DECIMAL(18, 3) NOT NULL,
    auto_deduct BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_product_inventory_links
        PRIMARY KEY (id),

    CONSTRAINT uq_product_inventory_links_business_link
        UNIQUE (business_id, id),

    CONSTRAINT uq_product_inventory_links_product_item
        UNIQUE (
            business_id,
            product_id,
            inventory_item_id
        ),

    CONSTRAINT fk_product_inventory_links_product
        FOREIGN KEY (
            business_id,
            product_id
        )
        REFERENCES products (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_product_inventory_links_item
        FOREIGN KEY (
            business_id,
            inventory_item_id
        )
        REFERENCES inventory_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_product_inventory_links_quantity
        CHECK (quantity_per_product > 0),

    INDEX idx_product_inventory_links_product (
        business_id,
        product_id,
        is_active
    ),

    INDEX idx_product_inventory_links_inventory_item (
        business_id,
        inventory_item_id,
        is_active
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE product_inventory_links;


-- ==============================================================
-- ARCHIVO: 036_allow_negative_inventory_stock.sql
-- ==============================================================

-- Migración 036:
-- Permite que el inventario refleje existencias negativas.
--
-- Un saldo negativo representa una diferencia entre el inventario
-- registrado y la existencia física. No debe bloquear ventas,
-- producción ni otros movimientos reales.

USE sazora_db;

ALTER TABLE inventory_items
    DROP CHECK chk_inventory_items_stock;

ALTER TABLE inventory_items
    ADD CONSTRAINT chk_inventory_items_minimum_stock
        CHECK (minimum_stock >= 0);

ALTER TABLE inventory_movement_lines
    DROP CHECK chk_inventory_movement_lines_balances;

SHOW CREATE TABLE inventory_items;
SHOW CREATE TABLE inventory_movement_lines;


-- ==============================================================
-- ARCHIVO: 037_create_product_combo_components.sql
-- ==============================================================

-- Migración 037:
-- Productos combo y sus productos componentes.

USE sazora_db;

CREATE TABLE IF NOT EXISTS product_combo_components (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    combo_product_id BIGINT UNSIGNED NOT NULL,
    component_product_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(18, 3) NOT NULL,
    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_product_combo_components
        PRIMARY KEY (id),

    CONSTRAINT uq_product_combo_component
        UNIQUE (
            business_id,
            combo_product_id,
            component_product_id
        ),

    CONSTRAINT fk_combo_components_combo_product
        FOREIGN KEY (
            business_id,
            combo_product_id
        )
        REFERENCES products (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_combo_components_component_product
        FOREIGN KEY (
            business_id,
            component_product_id
        )
        REFERENCES products (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_combo_components_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_combo_components_different_products
        CHECK (
            combo_product_id <> component_product_id
        ),

    INDEX idx_combo_components_combo (
        business_id,
        combo_product_id
    ),

    INDEX idx_combo_components_component (
        business_id,
        component_product_id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE product_combo_components;


-- ==============================================================
-- ARCHIVO: 038_allow_partial_order_item_cancellation.sql
-- ==============================================================

USE sazora_db;

ALTER TABLE order_item_changes
    DROP CHECK chk_order_item_changes_event_data;

ALTER TABLE order_item_changes
    ADD CONSTRAINT chk_order_item_changes_event_data
        CHECK (
            (
                change_type = 'ADDED'
                AND previous_quantity IS NULL
                AND new_quantity IS NOT NULL
                AND new_quantity > 0
                AND previous_notes IS NULL
                AND reason IS NULL
            )
            OR
            (
                change_type = 'QUANTITY_INCREASED'
                AND previous_quantity IS NOT NULL
                AND new_quantity IS NOT NULL
                AND previous_quantity > 0
                AND new_quantity > previous_quantity
                AND previous_notes IS NULL
                AND new_notes IS NULL
                AND reason IS NULL
            )
            OR
            (
                change_type = 'QUANTITY_DECREASED'
                AND previous_quantity IS NOT NULL
                AND new_quantity IS NOT NULL
                AND new_quantity > 0
                AND new_quantity < previous_quantity
                AND previous_notes IS NULL
                AND new_notes IS NULL
            )
            OR
            (
                change_type = 'NOTES_CHANGED'
                AND previous_quantity IS NULL
                AND new_quantity IS NULL
                AND NOT (previous_notes <=> new_notes)
                AND reason IS NULL
            )
            OR
            (
                change_type = 'CANCELLED'
                AND previous_quantity IS NOT NULL
                AND previous_quantity > 0
                AND new_quantity IS NULL
                AND previous_notes IS NULL
                AND new_notes IS NULL
                AND reason IS NOT NULL
            )
        );


-- ==============================================================
-- ARCHIVO: 039_create_organization_fiscal_profile.sql
-- ==============================================================

-- Migración 039:
-- Crea el perfil legal y fiscal de la única organización operadora.
--
-- businesses continúa representando a la organización propietaria.
-- No se elimina business_id: se conserva como límite de integridad.
--
-- Esta tabla almacena la información que posteriormente se enviará
-- al proveedor de facturación electrónica. No emite facturas.

USE sazora_db;

CREATE TABLE IF NOT EXISTS organization_fiscal_profiles (
    business_id BIGINT UNSIGNED NOT NULL,

    legal_name VARCHAR(200) NOT NULL,
    commercial_name VARCHAR(200) NULL,

    person_type VARCHAR(20) NOT NULL,
    document_type VARCHAR(20) NOT NULL DEFAULT 'NIT',
    document_number VARCHAR(30) NOT NULL,
    verification_digit CHAR(1) NULL,

    tax_regime_code VARCHAR(30) NULL,
    vat_responsibility_code VARCHAR(30) NULL,
    consumption_tax_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    economic_activity_code VARCHAR(10) NULL,

    fiscal_address VARCHAR(250) NOT NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'CO',
    department_code VARCHAR(5) NULL,
    department_name VARCHAR(100) NOT NULL,
    municipality_code VARCHAR(10) NULL,
    municipality_name VARCHAR(100) NOT NULL,
    postal_code VARCHAR(12) NULL,

    billing_email VARCHAR(254) NOT NULL,
    billing_phone VARCHAR(30) NULL,

    administrative_contact_name VARCHAR(150) NULL,
    administrative_contact_email VARCHAR(254) NULL,
    administrative_contact_phone VARCHAR(30) NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_organization_fiscal_profiles
        PRIMARY KEY (business_id),

    CONSTRAINT fk_organization_fiscal_profiles_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT uq_organization_fiscal_profiles_document
        UNIQUE (document_type, document_number),

    CONSTRAINT chk_organization_fiscal_profiles_person_type
        CHECK (
            person_type IN (
                'NATURAL_PERSON',
                'LEGAL_ENTITY'
            )
        ),

    CONSTRAINT chk_organization_fiscal_profiles_document_type
        CHECK (
            document_type IN (
                'NIT',
                'CC',
                'CE',
                'PASSPORT',
                'OTHER'
            )
        ),

    CONSTRAINT chk_organization_fiscal_profiles_legal_name
        CHECK (CHAR_LENGTH(TRIM(legal_name)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_document
        CHECK (CHAR_LENGTH(TRIM(document_number)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_verification_digit
        CHECK (
            verification_digit IS NULL
            OR verification_digit REGEXP '^[0-9]$'
        ),

    CONSTRAINT chk_organization_fiscal_profiles_country
        CHECK (country_code REGEXP '^[A-Z]{2}$'),

    CONSTRAINT chk_organization_fiscal_profiles_email
        CHECK (CHAR_LENGTH(TRIM(billing_email)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_address
        CHECK (CHAR_LENGTH(TRIM(fiscal_address)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_department
        CHECK (CHAR_LENGTH(TRIM(department_name)) > 0),

    CONSTRAINT chk_organization_fiscal_profiles_municipality
        CHECK (CHAR_LENGTH(TRIM(municipality_name)) > 0)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS organization_tax_responsibilities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_organization_tax_responsibilities
        PRIMARY KEY (id),

    CONSTRAINT uq_organization_tax_responsibilities
        UNIQUE (business_id, code),

    CONSTRAINT fk_organization_tax_responsibilities_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_organization_tax_responsibilities_code
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_organization_tax_responsibilities_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_organization_tax_responsibilities_active (
        business_id,
        is_active
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE organization_fiscal_profiles;
SHOW CREATE TABLE organization_tax_responsibilities;


-- ==============================================================
-- ARCHIVO: 040_create_locations_and_commercial_customers.sql
-- ==============================================================

-- Migración 040:
-- Crea la red operativa de la organización y los clientes comerciales.
--
-- Una ubicación propia puede ser:
-- - Planta/bodega de producción.
-- - Punto de venta.
--
-- Los clientes mayoristas son terceros. No deben registrarse como sedes.

USE sazora_db;

CREATE TABLE IF NOT EXISTS business_locations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    location_type VARCHAR(30) NOT NULL,

    address VARCHAR(250) NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'CO',
    department_code VARCHAR(5) NULL,
    department_name VARCHAR(100) NULL,
    municipality_code VARCHAR(10) NULL,
    municipality_name VARCHAR(100) NULL,
    postal_code VARCHAR(12) NULL,

    phone VARCHAR(30) NULL,
    email VARCHAR(254) NULL,

    is_inventory_location BOOLEAN NOT NULL DEFAULT TRUE,
    is_production_location BOOLEAN NOT NULL DEFAULT FALSE,
    is_sales_location BOOLEAN NOT NULL DEFAULT FALSE,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_locations
        PRIMARY KEY (id),

    CONSTRAINT uq_business_locations_business_location
        UNIQUE (business_id, id),

    CONSTRAINT uq_business_locations_business_code
        UNIQUE (business_id, code),

    CONSTRAINT fk_business_locations_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_business_locations_type
        CHECK (
            location_type IN (
                'PRODUCTION_WAREHOUSE',
                'POINT_OF_SALE'
            )
        ),

    CONSTRAINT chk_business_locations_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_business_locations_code
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_business_locations_capability
        CHECK (
            is_inventory_location = TRUE
            OR is_production_location = TRUE
            OR is_sales_location = TRUE
        ),

    INDEX idx_business_locations_type_active (
        business_id,
        location_type,
        is_active
    )
) ENGINE = InnoDB;

-- Crea una ubicación provisional para conservar la operación existente.
-- El administrador deberá editarla y clasificarla correctamente.
INSERT INTO business_locations (
    business_id,
    code,
    name,
    location_type,
    address,
    phone,
    is_inventory_location,
    is_production_location,
    is_sales_location
)
SELECT
    b.id,
    'PRINCIPAL',
    'Ubicación principal por configurar',
    'POINT_OF_SALE',
    bs.address,
    bs.phone,
    TRUE,
    FALSE,
    TRUE
FROM businesses AS b
LEFT JOIN business_settings AS bs
    ON bs.business_id = b.id
WHERE NOT EXISTS (
    SELECT 1
    FROM business_locations AS bl
    WHERE bl.business_id = b.id
);

CREATE TABLE IF NOT EXISTS business_membership_locations (
    business_id BIGINT UNSIGNED NOT NULL,
    business_membership_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_business_membership_locations
        PRIMARY KEY (
            business_id,
            business_membership_id,
            location_id
        ),

    CONSTRAINT fk_membership_locations_membership
        FOREIGN KEY (
            business_id,
            business_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_membership_locations_location
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

    INDEX idx_membership_locations_location (
        business_id,
        location_id
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS commercial_customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    customer_type VARCHAR(20) NOT NULL,
    legal_name VARCHAR(200) NOT NULL,
    commercial_name VARCHAR(200) NULL,

    document_type VARCHAR(20) NOT NULL,
    document_number VARCHAR(30) NOT NULL,
    verification_digit CHAR(1) NULL,

    billing_email VARCHAR(254) NULL,
    billing_phone VARCHAR(30) NULL,

    fiscal_address VARCHAR(250) NULL,
    country_code CHAR(2) NOT NULL DEFAULT 'CO',
    department_code VARCHAR(5) NULL,
    department_name VARCHAR(100) NULL,
    municipality_code VARCHAR(10) NULL,
    municipality_name VARCHAR(100) NULL,
    postal_code VARCHAR(12) NULL,

    tax_regime_code VARCHAR(30) NULL,
    vat_responsibility_code VARCHAR(30) NULL,

    payment_term_days SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    requires_electronic_invoice BOOLEAN NOT NULL DEFAULT TRUE,

    notes VARCHAR(500) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_commercial_customers
        PRIMARY KEY (id),

    CONSTRAINT uq_commercial_customers_business_customer
        UNIQUE (business_id, id),

    CONSTRAINT uq_commercial_customers_document
        UNIQUE (
            business_id,
            document_type,
            document_number
        ),

    CONSTRAINT fk_commercial_customers_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_commercial_customers_type
        CHECK (
            customer_type IN (
                'PERSON',
                'COMPANY'
            )
        ),

    CONSTRAINT chk_commercial_customers_document_type
        CHECK (
            document_type IN (
                'NIT',
                'CC',
                'CE',
                'PASSPORT',
                'OTHER'
            )
        ),

    CONSTRAINT chk_commercial_customers_legal_name
        CHECK (CHAR_LENGTH(TRIM(legal_name)) > 0),

    CONSTRAINT chk_commercial_customers_document
        CHECK (CHAR_LENGTH(TRIM(document_number)) > 0),

    CONSTRAINT chk_commercial_customers_verification_digit
        CHECK (
            verification_digit IS NULL
            OR verification_digit REGEXP '^[0-9]$'
        ),

    INDEX idx_commercial_customers_active_name (
        business_id,
        is_active,
        legal_name
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS commercial_customer_delivery_locations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(150) NOT NULL,
    address VARCHAR(250) NOT NULL,

    country_code CHAR(2) NOT NULL DEFAULT 'CO',
    department_code VARCHAR(5) NULL,
    department_name VARCHAR(100) NULL,
    municipality_code VARCHAR(10) NULL,
    municipality_name VARCHAR(100) NULL,
    postal_code VARCHAR(12) NULL,

    contact_name VARCHAR(150) NULL,
    contact_phone VARCHAR(30) NULL,
    delivery_notes VARCHAR(500) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_commercial_customer_delivery_locations
        PRIMARY KEY (id),

    CONSTRAINT uq_customer_delivery_locations_business_location
        UNIQUE (business_id, id),

    CONSTRAINT uq_customer_delivery_locations_customer_location
        UNIQUE (business_id, customer_id, id),

    CONSTRAINT fk_customer_delivery_locations_customer
        FOREIGN KEY (
            business_id,
            customer_id
        )
        REFERENCES commercial_customers (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_customer_delivery_locations_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    CONSTRAINT chk_customer_delivery_locations_address
        CHECK (CHAR_LENGTH(TRIM(address)) > 0),

    INDEX idx_customer_delivery_locations_customer (
        business_id,
        customer_id,
        is_active
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE business_locations;
SHOW CREATE TABLE business_membership_locations;
SHOW CREATE TABLE commercial_customers;
SHOW CREATE TABLE commercial_customer_delivery_locations;


-- ==============================================================
-- ARCHIVO: 041_enforce_default_employee_location.sql
-- ==============================================================

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


-- ==============================================================
-- ARCHIVO: 042_add_production_role.sql
-- ==============================================================

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


-- ==============================================================
-- ARCHIVO: 043_create_preparation_area_locations.sql
-- ==============================================================

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


-- ==============================================================
-- ARCHIVO: 044_add_location_to_restaurant_tables.sql
-- ==============================================================

-- Migración 044:
-- Asigna cada mesa física a un único punto de venta.
--
-- Una mesa no puede pertenecer a una planta de producción.
-- El código de mesa pasa a ser único por ubicación.

USE sazora_db;

ALTER TABLE restaurant_tables
    ADD COLUMN location_id BIGINT UNSIGNED NULL
        AFTER business_id;

-- Compatibilidad con las mesas existentes:
-- se asignan provisionalmente al primer punto de venta activo del negocio.
--
-- Después de ejecutar la migración se debe verificar esta asignación.
UPDATE restaurant_tables AS rt
INNER JOIN (
    SELECT
        business_id,
        MIN(id) AS location_id
    FROM business_locations
    WHERE
        location_type = 'POINT_OF_SALE'
        AND is_active = TRUE
    GROUP BY business_id
) AS default_sales_location
    ON default_sales_location.business_id = rt.business_id
SET rt.location_id = default_sales_location.location_id
WHERE
    rt.id > 0
    AND rt.location_id IS NULL;

ALTER TABLE restaurant_tables
    MODIFY COLUMN location_id BIGINT UNSIGNED NOT NULL;

ALTER TABLE restaurant_tables
    DROP INDEX uq_restaurant_tables_business_code;

ALTER TABLE restaurant_tables
    DROP INDEX idx_restaurant_tables_business_active_name;

ALTER TABLE restaurant_tables
    ADD CONSTRAINT uq_restaurant_tables_business_location_code
        UNIQUE (
            business_id,
            location_id,
            code
        ),

    ADD CONSTRAINT uq_restaurant_tables_business_location_table
        UNIQUE (
            business_id,
            location_id,
            id
        ),

    ADD CONSTRAINT fk_restaurant_tables_location
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

    ADD INDEX idx_restaurant_tables_location_active_name (
        business_id,
        location_id,
        is_active,
        name
    );

SELECT
    rt.id,
    rt.code,
    rt.name,
    bl.code AS location_code,
    bl.name AS location_name
FROM restaurant_tables AS rt
INNER JOIN business_locations AS bl
    ON bl.business_id = rt.business_id
    AND bl.id = rt.location_id
ORDER BY
    bl.name,
    rt.name;

SHOW CREATE TABLE restaurant_tables;
SHOW INDEX FROM restaurant_tables;


-- ==============================================================
-- ARCHIVO: 045_add_location_to_orders.sql
-- ==============================================================

-- Migración 045:
-- Asigna cada orden a un punto de venta.
--
-- Las órdenes de mesa heredan la ubicación de su mesa.
-- Las demás órdenes usan la ubicación predeterminada del empleado
-- o, como respaldo para datos históricos, el primer punto de venta activo.

USE sazora_db;

ALTER TABLE orders
    ADD COLUMN location_id BIGINT UNSIGNED NULL
        AFTER business_id;

-- Órdenes de mesa: toman la ubicación de la mesa.
UPDATE orders AS o
INNER JOIN restaurant_tables AS rt
    ON rt.business_id = o.business_id
    AND rt.id = o.restaurant_table_id
SET o.location_id = rt.location_id
WHERE
    o.id > 0
    AND o.location_id IS NULL
    AND o.service_type = 'TABLE';

-- TAKEAWAY y DELIVERY:
-- intentan usar la ubicación predeterminada del empleado.
UPDATE orders AS o
INNER JOIN business_membership_locations AS bml
    ON bml.business_id = o.business_id
    AND bml.business_membership_id = o.opened_by_membership_id
    AND bml.is_default = TRUE
INNER JOIN business_locations AS bl
    ON bl.business_id = bml.business_id
    AND bl.id = bml.location_id
    AND bl.location_type = 'POINT_OF_SALE'
SET o.location_id = bl.id
WHERE
    o.id > 0
    AND o.location_id IS NULL;

-- Respaldo para órdenes históricas sin una ubicación predeterminada válida.
UPDATE orders AS o
INNER JOIN (
    SELECT
        business_id,
        MIN(id) AS location_id
    FROM business_locations
    WHERE
        location_type = 'POINT_OF_SALE'
        AND is_active = TRUE
    GROUP BY business_id
) AS fallback_location
    ON fallback_location.business_id = o.business_id
SET o.location_id = fallback_location.location_id
WHERE
    o.id > 0
    AND o.location_id IS NULL;

-- Esta consulta debe retornar cero antes de continuar.
SELECT
    COUNT(*) AS orders_without_location
FROM orders
WHERE location_id IS NULL;

ALTER TABLE orders
    MODIFY COLUMN location_id BIGINT UNSIGNED NOT NULL;

ALTER TABLE orders
    ADD CONSTRAINT uq_orders_business_location_order
        UNIQUE (
            business_id,
            location_id,
            id
        ),

    ADD CONSTRAINT fk_orders_location
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

    ADD CONSTRAINT fk_orders_table_location
        FOREIGN KEY (
            business_id,
            location_id,
            restaurant_table_id
        )
        REFERENCES restaurant_tables (
            business_id,
            location_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    ADD INDEX idx_orders_location_status_created (
        business_id,
        location_id,
        status,
        created_at
    ),

    ADD INDEX idx_orders_location_service_created (
        business_id,
        location_id,
        service_type,
        created_at
    );

SELECT
    o.id,
    o.service_type,
    o.status,
    o.restaurant_table_id,
    bl.id AS location_id,
    bl.code AS location_code,
    bl.name AS location_name
FROM orders AS o
INNER JOIN business_locations AS bl
    ON bl.business_id = o.business_id
    AND bl.id = o.location_id
ORDER BY o.id;

SHOW CREATE TABLE orders;
SHOW INDEX FROM orders;


-- ==============================================================
-- ARCHIVO: 046_create_location_kitchen_settings.sql
-- ==============================================================

-- Migración 046:
-- Configura el flujo de cocina por punto de venta.
--
-- PRINT_ONLY:
-- La cocina trabaja con comandas impresas y la orden se entrega
-- mediante el flujo simplificado de Ventas/Meseros.
--
-- PRINT_AND_SCREEN:
-- La cocina usa comandas impresas y la pantalla de cocina.
--
-- La orden conserva una copia del modo con el que fue confirmada.

USE sazora_db;

CREATE TABLE IF NOT EXISTS location_kitchen_settings (
    business_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,

    workflow_mode VARCHAR(30) NOT NULL
        DEFAULT 'PRINT_AND_SCREEN',

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_location_kitchen_settings
        PRIMARY KEY (
            business_id,
            location_id
        ),

    CONSTRAINT fk_location_kitchen_settings_location
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

    CONSTRAINT chk_location_kitchen_settings_mode
        CHECK (
            workflow_mode IN (
                'PRINT_ONLY',
                'PRINT_AND_SCREEN'
            )
        )
) ENGINE = InnoDB;

-- Conserva el funcionamiento actual para los puntos de venta existentes.
INSERT IGNORE INTO location_kitchen_settings (
    business_id,
    location_id,
    workflow_mode
)
SELECT
    business_id,
    id,
    'PRINT_AND_SCREEN'
FROM business_locations
WHERE location_type = 'POINT_OF_SALE';

ALTER TABLE orders
    ADD COLUMN kitchen_workflow_mode VARCHAR(30) NULL
        AFTER status;

-- Las órdenes históricas que ya salieron del estado OPEN
-- conservarán el comportamiento actual con pantalla.
UPDATE orders
SET kitchen_workflow_mode = 'PRINT_AND_SCREEN'
WHERE
    id > 0
    AND status <> 'OPEN'
    AND kitchen_workflow_mode IS NULL;

ALTER TABLE orders
    ADD CONSTRAINT chk_orders_kitchen_workflow_mode
        CHECK (
            kitchen_workflow_mode IS NULL
            OR kitchen_workflow_mode IN (
                'PRINT_ONLY',
                'PRINT_AND_SCREEN'
            )
        );

SELECT
    bl.id AS location_id,
    bl.code,
    bl.name,
    lks.workflow_mode
FROM business_locations AS bl
LEFT JOIN location_kitchen_settings AS lks
    ON lks.business_id = bl.business_id
    AND lks.location_id = bl.id
WHERE bl.location_type = 'POINT_OF_SALE'
ORDER BY bl.business_id, bl.name;

SELECT
    status,
    kitchen_workflow_mode,
    COUNT(*) AS total
FROM orders
GROUP BY
    status,
    kitchen_workflow_mode
ORDER BY status, kitchen_workflow_mode;

SHOW CREATE TABLE location_kitchen_settings;
SHOW CREATE TABLE orders;


-- ==============================================================
-- ARCHIVO: 047_create_location_inventory_valuation.sql
-- ==============================================================

USE sazora_db;

-- =========================================================
-- 1. Saldo físico y económico por artículo y ubicación
-- =========================================================

CREATE TABLE inventory_location_balances (
    business_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    current_stock DECIMAL(18, 3) NOT NULL
        DEFAULT 0.000,

    minimum_stock DECIMAL(18, 3) NOT NULL
        DEFAULT 0.000,

    average_unit_cost DECIMAL(24, 6) NULL,
    inventory_value DECIMAL(24, 6) NULL,

    valuation_status VARCHAR(20) NOT NULL
        DEFAULT 'UNVALUED',

    migrated_from_legacy BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_location_balances
        PRIMARY KEY (
            business_id,
            location_id,
            inventory_item_id
        ),

    CONSTRAINT fk_inventory_location_balances_location
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

    CONSTRAINT fk_inventory_location_balances_item
        FOREIGN KEY (
            business_id,
            inventory_item_id
        )
        REFERENCES inventory_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_location_minimum_stock
        CHECK (minimum_stock >= 0),

    CONSTRAINT chk_inventory_location_average_cost
        CHECK (
            average_unit_cost IS NULL
            OR average_unit_cost >= 0
        ),

    CONSTRAINT chk_inventory_location_valuation_status
        CHECK (
            valuation_status IN (
                'UNVALUED',
                'VALUED'
            )
        ),

    CONSTRAINT chk_inventory_location_valuation_data
        CHECK (
            (
                valuation_status = 'UNVALUED'
                AND average_unit_cost IS NULL
                AND inventory_value IS NULL
            )
            OR
            (
                valuation_status = 'VALUED'
                AND (
                    (
                        current_stock = 0
                        AND average_unit_cost IS NULL
                        AND inventory_value = 0
                    )
                    OR
                    (
                        average_unit_cost IS NOT NULL
                        AND inventory_value IS NOT NULL
                    )
                )
            )
        ),

    INDEX idx_inventory_location_balances_item (
        business_id,
        inventory_item_id,
        location_id
    ),

    INDEX idx_inventory_location_balances_location_stock (
        business_id,
        location_id,
        current_stock
    ),

    INDEX idx_inventory_location_balances_valuation (
        business_id,
        location_id,
        valuation_status
    )
) ENGINE = InnoDB;

-- =========================================================
-- 2. Historial de valoraciones y correcciones de costo
-- =========================================================

CREATE TABLE inventory_valuation_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    event_type VARCHAR(30) NOT NULL,

    quantity_snapshot DECIMAL(18, 3) NOT NULL,

    previous_average_unit_cost DECIMAL(24, 6) NULL,
    new_average_unit_cost DECIMAL(24, 6) NOT NULL,

    previous_inventory_value DECIMAL(24, 6) NULL,
    new_inventory_value DECIMAL(24, 6) NOT NULL,

    reason VARCHAR(500) NOT NULL,

    created_by_membership_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_valuation_events
        PRIMARY KEY (id),

    CONSTRAINT fk_inventory_valuation_events_balance
        FOREIGN KEY (
            business_id,
            location_id,
            inventory_item_id
        )
        REFERENCES inventory_location_balances (
            business_id,
            location_id,
            inventory_item_id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_valuation_events_membership
        FOREIGN KEY (
            business_id,
            created_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_valuation_event_type
        CHECK (
            event_type IN (
                'INITIAL_VALUATION',
                'COST_CORRECTION'
            )
        ),

    CONSTRAINT chk_inventory_valuation_event_cost
        CHECK (
            new_average_unit_cost >= 0
            AND new_inventory_value >= 0
        ),

    CONSTRAINT chk_inventory_valuation_event_reason
        CHECK (
            CHAR_LENGTH(TRIM(reason)) > 0
        ),

    INDEX idx_inventory_valuation_events_item (
        business_id,
        inventory_item_id,
        location_id,
        created_at
    ),

    INDEX idx_inventory_valuation_events_location (
        business_id,
        location_id,
        created_at
    )
) ENGINE = InnoDB;

-- =========================================================
-- 3. Preparar movimientos para ubicación y costos
-- =========================================================

ALTER TABLE inventory_movements
    ADD COLUMN location_id BIGINT UNSIGNED NULL
        AFTER business_id,

    ADD CONSTRAINT fk_inventory_movements_location
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

    ADD INDEX idx_inventory_movements_location_created (
        business_id,
        location_id,
        created_at
    );

ALTER TABLE inventory_movement_lines
    ADD COLUMN unit_cost DECIMAL(24, 6) NULL
        AFTER quantity,

    ADD COLUMN total_cost DECIMAL(24, 6) NULL
        AFTER unit_cost,

    ADD COLUMN average_unit_cost_before DECIMAL(24, 6) NULL
        AFTER balance_after,

    ADD COLUMN average_unit_cost_after DECIMAL(24, 6) NULL
        AFTER average_unit_cost_before,

    ADD COLUMN inventory_value_before DECIMAL(24, 6) NULL
        AFTER average_unit_cost_after,

    ADD COLUMN inventory_value_after DECIMAL(24, 6) NULL
        AFTER inventory_value_before,

    ADD COLUMN cost_status VARCHAR(30) NOT NULL
        DEFAULT 'UNVALUED_LEGACY'
        AFTER inventory_value_after,

    ADD CONSTRAINT chk_inventory_movement_line_cost_status
        CHECK (
            cost_status IN (
                'UNVALUED_LEGACY',
                'VALUED'
            )
        ),

    ADD CONSTRAINT chk_inventory_movement_line_cost_data
        CHECK (
            (
                cost_status = 'UNVALUED_LEGACY'
                AND unit_cost IS NULL
                AND total_cost IS NULL
                AND average_unit_cost_before IS NULL
                AND average_unit_cost_after IS NULL
                AND inventory_value_before IS NULL
                AND inventory_value_after IS NULL
            )
            OR
            (
                cost_status = 'VALUED'
                AND unit_cost IS NOT NULL
                AND total_cost IS NOT NULL
                AND average_unit_cost_after IS NOT NULL
                AND inventory_value_after IS NOT NULL
            )
        );

-- =========================================================
-- 4. Migrar existencias globales actuales
-- =========================================================
--
-- Como el sistema anterior no conocía ubicación, el saldo existente se
-- asigna a la ubicación de inventario más antigua del negocio.
--
-- Se marca migrated_from_legacy = TRUE.
--
-- Los saldos distintos de cero quedan UNVALUED porque no conocemos su
-- costo histórico. Los saldos en cero se consideran VALUED con valor 0.
-- =========================================================

INSERT INTO inventory_location_balances (
    business_id,
    location_id,
    inventory_item_id,
    current_stock,
    minimum_stock,
    average_unit_cost,
    inventory_value,
    valuation_status,
    migrated_from_legacy
)
SELECT
    ii.business_id,

    (
        SELECT MIN(bl.id)
        FROM business_locations AS bl
        WHERE
            bl.business_id = ii.business_id
            AND bl.is_inventory_location = TRUE
    ) AS location_id,

    ii.id,
    ii.current_stock,
    ii.minimum_stock,

    NULL AS average_unit_cost,

    CASE
        WHEN ii.current_stock = 0
            THEN 0.000000
        ELSE NULL
    END AS inventory_value,

    CASE
        WHEN ii.current_stock = 0
            THEN 'VALUED'
        ELSE 'UNVALUED'
    END AS valuation_status,

    TRUE AS migrated_from_legacy

FROM inventory_items AS ii

WHERE EXISTS (
    SELECT 1
    FROM business_locations AS bl
    WHERE
        bl.business_id = ii.business_id
        AND bl.is_inventory_location = TRUE
);

SELECT
    ilb.business_id,
    ilb.location_id,
    bl.code AS location_code,
    ilb.inventory_item_id,
    ii.name AS inventory_item_name,
    ilb.current_stock,
    ilb.average_unit_cost,
    ilb.inventory_value,
    ilb.valuation_status,
    ilb.migrated_from_legacy
FROM inventory_location_balances AS ilb
INNER JOIN business_locations AS bl
    ON bl.business_id = ilb.business_id
    AND bl.id = ilb.location_id
INNER JOIN inventory_items AS ii
    ON ii.business_id = ilb.business_id
    AND ii.id = ilb.inventory_item_id
ORDER BY
    ilb.business_id,
    bl.name,
    ii.name;

SHOW CREATE TABLE inventory_location_balances;
SHOW CREATE TABLE inventory_valuation_events;
SHOW CREATE TABLE inventory_movements;
SHOW CREATE TABLE inventory_movement_lines;


-- ==============================================================
-- ARCHIVO: 048_create_inventory_purchase_costing.sql
-- ==============================================================

USE sazora_db;

-- =========================================================
-- 1. Presentaciones utilizadas para comprar inventario
-- =========================================================

CREATE TABLE inventory_purchase_presentations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    name VARCHAR(120) NOT NULL,

    -- Cantidad de unidades base contenidas en una presentación.
    --
    -- Ejemplos:
    -- Bulto de harina de 50 kg, artículo medido en GRAM:
    -- conversion_factor = 50000
    --
    -- Caja de 24 botellas, artículo medido en UNIT:
    -- conversion_factor = 24
    conversion_factor DECIMAL(18, 6) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_inventory_purchase_presentations
        PRIMARY KEY (id),

    CONSTRAINT uq_inventory_purchase_presentations_business_id
        UNIQUE (business_id, id),

    CONSTRAINT uq_inventory_purchase_presentations_name
        UNIQUE (
            business_id,
            inventory_item_id,
            name
        ),

    CONSTRAINT fk_inventory_purchase_presentations_item
        FOREIGN KEY (
            business_id,
            inventory_item_id
        )
        REFERENCES inventory_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_purchase_conversion_factor
        CHECK (conversion_factor > 0),

    CONSTRAINT chk_inventory_purchase_presentation_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_inventory_purchase_presentations_item (
        business_id,
        inventory_item_id,
        is_active
    )
) ENGINE = InnoDB;

-- =========================================================
-- 2. Referencia externa de la compra
-- =========================================================

ALTER TABLE inventory_movements
    ADD COLUMN external_reference VARCHAR(120) NULL
        AFTER source_id;

-- =========================================================
-- 3. Guardar la presentación original usada en la compra
-- =========================================================

ALTER TABLE inventory_movement_lines
    ADD COLUMN purchase_presentation_id BIGINT UNSIGNED NULL
        AFTER inventory_item_id,

    ADD COLUMN purchase_presentation_name VARCHAR(120) NULL
        AFTER purchase_presentation_id,

    ADD COLUMN purchased_quantity DECIMAL(18, 3) NULL
        AFTER purchase_presentation_name,

    ADD COLUMN purchase_conversion_factor DECIMAL(18, 6) NULL
        AFTER purchased_quantity,

    ADD CONSTRAINT fk_inventory_movement_lines_presentation
        FOREIGN KEY (
            business_id,
            purchase_presentation_id
        )
        REFERENCES inventory_purchase_presentations (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    ADD CONSTRAINT chk_inventory_movement_purchase_snapshot
        CHECK (
            (
                purchase_presentation_id IS NULL
                AND purchase_presentation_name IS NULL
                AND purchased_quantity IS NULL
                AND purchase_conversion_factor IS NULL
            )
            OR
            (
                purchase_presentation_id IS NOT NULL
                AND purchase_presentation_name IS NOT NULL
                AND purchased_quantity > 0
                AND purchase_conversion_factor > 0
            )
        );

SHOW CREATE TABLE inventory_purchase_presentations;
SHOW CREATE TABLE inventory_movements;
SHOW CREATE TABLE inventory_movement_lines;


-- ==============================================================
-- ARCHIVO: 049_complete_inventory_purchase_costing.sql
-- ==============================================================

USE sazora_db;

-- =========================================================
-- 1. Información documental y totales de la compra
-- =========================================================

ALTER TABLE inventory_movements
    ADD COLUMN supplier_name VARCHAR(160) NULL
        AFTER external_reference,

    ADD COLUMN supplier_document VARCHAR(80) NULL
        AFTER supplier_name,

    ADD COLUMN document_date DATE NULL
        AFTER supplier_document,

    ADD COLUMN purchase_gross_total DECIMAL(24, 6) NULL
        AFTER document_date,

    ADD COLUMN purchase_discount_total DECIMAL(24, 6) NULL
        AFTER purchase_gross_total,

    ADD COLUMN purchase_additional_cost_total DECIMAL(24, 6) NULL
        AFTER purchase_discount_total,

    ADD COLUMN purchase_net_total DECIMAL(24, 6) NULL
        AFTER purchase_additional_cost_total,

    ADD COLUMN purchase_cost_status VARCHAR(30) NULL
        AFTER purchase_net_total;

-- =========================================================
-- 2. Composición económica por línea
-- =========================================================

ALTER TABLE inventory_movement_lines
    ADD COLUMN gross_cost DECIMAL(24, 6) NULL
        AFTER purchase_conversion_factor,

    ADD COLUMN discount_amount DECIMAL(24, 6) NULL
        AFTER gross_cost,

    ADD COLUMN additional_cost_amount DECIMAL(24, 6) NULL
        AFTER discount_amount;

-- =========================================================
-- 3. Recuperar compras valoradas creadas con migración 048
-- =========================================================
-- MySQL Workbench puede tener habilitado safe update mode.
SET @previous_sql_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

UPDATE inventory_movement_lines AS iml
INNER JOIN inventory_movements AS im
    ON im.business_id = iml.business_id
    AND im.id = iml.movement_id
SET
    iml.gross_cost = iml.total_cost,
    iml.discount_amount = 0.000000,
    iml.additional_cost_amount = 0.000000
WHERE
    im.movement_type = 'PURCHASE'
    AND iml.cost_status = 'VALUED'
    AND iml.total_cost IS NOT NULL
    AND iml.gross_cost IS NULL;

UPDATE inventory_movements AS im
INNER JOIN (
    SELECT
        iml.business_id,
        iml.movement_id,
        SUM(iml.gross_cost) AS gross_total,
        SUM(iml.discount_amount) AS discount_total,
        SUM(iml.additional_cost_amount) AS additional_cost_total,
        SUM(iml.total_cost) AS net_total
    FROM inventory_movement_lines AS iml
    WHERE
        iml.cost_status = 'VALUED'
        AND iml.gross_cost IS NOT NULL
    GROUP BY
        iml.business_id,
        iml.movement_id
) AS totals
    ON totals.business_id = im.business_id
    AND totals.movement_id = im.id
SET
    im.purchase_gross_total = totals.gross_total,
    im.purchase_discount_total = totals.discount_total,
    im.purchase_additional_cost_total =
        totals.additional_cost_total,
    im.purchase_net_total = totals.net_total,
    im.purchase_cost_status = 'VALUED'
WHERE
    im.movement_type = 'PURCHASE';


UPDATE inventory_movements
SET purchase_cost_status = 'LEGACY_UNVALUED'
WHERE
    movement_type = 'PURCHASE'
    AND purchase_cost_status IS NULL;

SET SQL_SAFE_UPDATES = @previous_sql_safe_updates;

-- =========================================================
-- 4. Restricciones económicas
-- =========================================================

ALTER TABLE inventory_movements
    ADD CONSTRAINT chk_inventory_purchase_cost_status
        CHECK (
            purchase_cost_status IS NULL
            OR purchase_cost_status IN (
                'LEGACY_UNVALUED',
                'VALUED'
            )
        ),

    ADD CONSTRAINT chk_inventory_purchase_totals
        CHECK (
            (
                purchase_cost_status IS NULL
                AND purchase_gross_total IS NULL
                AND purchase_discount_total IS NULL
                AND purchase_additional_cost_total IS NULL
                AND purchase_net_total IS NULL
            )
            OR
            (
                purchase_cost_status = 'LEGACY_UNVALUED'
                AND purchase_gross_total IS NULL
                AND purchase_discount_total IS NULL
                AND purchase_additional_cost_total IS NULL
                AND purchase_net_total IS NULL
            )
            OR
            (
                purchase_cost_status = 'VALUED'
                AND purchase_gross_total > 0
                AND purchase_discount_total >= 0
                AND purchase_discount_total
                    <= purchase_gross_total
                AND purchase_additional_cost_total >= 0
                AND purchase_net_total > 0
                AND purchase_net_total = ROUND(
                    purchase_gross_total
                    - purchase_discount_total
                    + purchase_additional_cost_total,
                    6
                )
            )
        );

ALTER TABLE inventory_movement_lines
    ADD CONSTRAINT chk_inventory_purchase_line_costs
        CHECK (
            (
                gross_cost IS NULL
                AND discount_amount IS NULL
                AND additional_cost_amount IS NULL
            )
            OR
            (
                gross_cost > 0
                AND discount_amount >= 0
                AND discount_amount <= gross_cost
                AND additional_cost_amount >= 0
                AND total_cost > 0
                AND total_cost = ROUND(
                    gross_cost
                    - discount_amount
                    + additional_cost_amount,
                    6
                )
            )
        );

CREATE INDEX idx_inventory_purchases_supplier
    ON inventory_movements (
        business_id,
        supplier_name,
        created_at
    );

CREATE INDEX idx_inventory_purchases_document_date
    ON inventory_movements (
        business_id,
        document_date,
        created_at
    );

SHOW CREATE TABLE inventory_movements;
SHOW CREATE TABLE inventory_movement_lines;


-- ==============================================================
-- ARCHIVO: 050_add_valued_inventory_returns.sql
-- ==============================================================

USE sazora_db;

-- =========================================================
-- Migración 050
-- Distinguir devoluciones de cliente y a proveedor
-- =========================================================

ALTER TABLE inventory_movements
    ADD COLUMN return_kind VARCHAR(30) NULL
        AFTER movement_type;

-- Los movimientos RETURN anteriores solamente permitían entradas,
-- por lo que se consideran devoluciones de clientes.

SET @previous_sql_safe_updates = @@SQL_SAFE_UPDATES;
SET SQL_SAFE_UPDATES = 0;

UPDATE inventory_movements
SET return_kind = 'CUSTOMER_RETURN'
WHERE
    movement_type = 'RETURN'
    AND return_kind IS NULL;

SET SQL_SAFE_UPDATES = @previous_sql_safe_updates;

ALTER TABLE inventory_movements
    ADD CONSTRAINT chk_inventory_movement_return_kind
        CHECK (
            (
                movement_type = 'RETURN'
                AND return_kind IN (
                    'CUSTOMER_RETURN',
                    'SUPPLIER_RETURN'
                )
            )
            OR
            (
                movement_type <> 'RETURN'
                AND return_kind IS NULL
            )
        );

CREATE INDEX idx_inventory_movements_return_kind
    ON inventory_movements (
        business_id,
        return_kind,
        created_at
    );

SHOW CREATE TABLE inventory_movements;


-- ==============================================================
-- ARCHIVO: 051_create_production_recipes.sql
-- ==============================================================

USE sazora_db;

-- =========================================================
-- Migración 051
-- Recetas o fórmulas de producción
-- =========================================================

CREATE TABLE IF NOT EXISTS production_recipes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    notes VARCHAR(500) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by_membership_id BIGINT UNSIGNED NOT NULL,
    updated_by_membership_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_recipes
        PRIMARY KEY (id),

    CONSTRAINT uq_production_recipes_business_recipe
        UNIQUE (business_id, id),

    CONSTRAINT uq_production_recipes_business_code
        UNIQUE (business_id, code),

    CONSTRAINT fk_production_recipes_business
        FOREIGN KEY (business_id)
        REFERENCES businesses (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_recipes_created_by
        FOREIGN KEY (
            business_id,
            created_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_recipes_updated_by
        FOREIGN KEY (
            business_id,
            updated_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_production_recipes_code
        CHECK (CHAR_LENGTH(TRIM(code)) > 0),

    CONSTRAINT chk_production_recipes_name
        CHECK (CHAR_LENGTH(TRIM(name)) > 0),

    INDEX idx_production_recipes_business_active (
        business_id,
        is_active,
        name
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS production_recipe_inputs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    recipe_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    quantity DECIMAL(18, 3) NOT NULL,
    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_recipe_inputs
        PRIMARY KEY (id),

    CONSTRAINT uq_production_recipe_inputs_item
        UNIQUE (
            business_id,
            recipe_id,
            inventory_item_id
        ),

    CONSTRAINT fk_production_recipe_inputs_recipe
        FOREIGN KEY (
            business_id,
            recipe_id
        )
        REFERENCES production_recipes (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_production_recipe_inputs_item
        FOREIGN KEY (
            business_id,
            inventory_item_id
        )
        REFERENCES inventory_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_production_recipe_inputs_quantity
        CHECK (quantity > 0),

    INDEX idx_production_recipe_inputs_recipe (
        business_id,
        recipe_id,
        id
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS production_recipe_outputs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    recipe_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    quantity DECIMAL(18, 3) NOT NULL,

    cost_allocation_percentage
        DECIMAL(9, 6) NOT NULL,

    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_recipe_outputs
        PRIMARY KEY (id),

    CONSTRAINT uq_production_recipe_outputs_item
        UNIQUE (
            business_id,
            recipe_id,
            inventory_item_id
        ),

    CONSTRAINT fk_production_recipe_outputs_recipe
        FOREIGN KEY (
            business_id,
            recipe_id
        )
        REFERENCES production_recipes (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_production_recipe_outputs_item
        FOREIGN KEY (
            business_id,
            inventory_item_id
        )
        REFERENCES inventory_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_production_recipe_outputs_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_production_recipe_output_allocation
        CHECK (
            cost_allocation_percentage > 0
            AND cost_allocation_percentage <= 100
        ),

    INDEX idx_production_recipe_outputs_recipe (
        business_id,
        recipe_id,
        id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE production_recipes;
SHOW CREATE TABLE production_recipe_inputs;
SHOW CREATE TABLE production_recipe_outputs;


-- ==============================================================
-- ARCHIVO: 052_create_production_orders.sql
-- ==============================================================

USE sazora_db;

-- =========================================================
-- Migración 052
-- Órdenes de producción y copia histórica de la receta
-- =========================================================

CREATE TABLE IF NOT EXISTS production_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    recipe_id BIGINT UNSIGNED NOT NULL,
    location_id BIGINT UNSIGNED NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',

    batch_quantity DECIMAL(18, 3) NOT NULL,

    recipe_code_snapshot VARCHAR(50) NOT NULL,
    recipe_name_snapshot VARCHAR(150) NOT NULL,

    planned_for DATETIME(3) NULL,
    notes VARCHAR(500) NULL,

    inventory_movement_id BIGINT UNSIGNED NULL,

    version INT UNSIGNED NOT NULL DEFAULT 1,

    created_by_membership_id BIGINT UNSIGNED NOT NULL,
    updated_by_membership_id BIGINT UNSIGNED NOT NULL,

    started_by_membership_id BIGINT UNSIGNED NULL,
    completed_by_membership_id BIGINT UNSIGNED NULL,
    cancelled_by_membership_id BIGINT UNSIGNED NULL,

    started_at DATETIME(3) NULL,
    completed_at DATETIME(3) NULL,
    cancelled_at DATETIME(3) NULL,
    cancellation_reason VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_orders
        PRIMARY KEY (id),

    CONSTRAINT uq_production_orders_business_order
        UNIQUE (business_id, id),

    CONSTRAINT uq_production_orders_inventory_movement
        UNIQUE (
            business_id,
            inventory_movement_id
        ),

    CONSTRAINT fk_production_orders_recipe
        FOREIGN KEY (
            business_id,
            recipe_id
        )
        REFERENCES production_recipes (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_location
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

    CONSTRAINT fk_production_orders_movement
        FOREIGN KEY (
            business_id,
            inventory_movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_created_by
        FOREIGN KEY (
            business_id,
            created_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_updated_by
        FOREIGN KEY (
            business_id,
            updated_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_started_by
        FOREIGN KEY (
            business_id,
            started_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_completed_by
        FOREIGN KEY (
            business_id,
            completed_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_orders_cancelled_by
        FOREIGN KEY (
            business_id,
            cancelled_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_production_orders_status
        CHECK (
            status IN (
                'DRAFT',
                'PLANNED',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_production_orders_batch_quantity
        CHECK (batch_quantity > 0),

    CONSTRAINT chk_production_orders_version
        CHECK (version > 0),

    CONSTRAINT chk_production_orders_movement_status
        CHECK (
            (
                status = 'COMPLETED'
                AND inventory_movement_id IS NOT NULL
                AND completed_at IS NOT NULL
                AND completed_by_membership_id IS NOT NULL
            )
            OR
            (
                status <> 'COMPLETED'
                AND inventory_movement_id IS NULL
            )
        ),

    CONSTRAINT chk_production_orders_cancellation
        CHECK (
            (
                status = 'CANCELLED'
                AND cancelled_at IS NOT NULL
                AND cancelled_by_membership_id IS NOT NULL
                AND cancellation_reason IS NOT NULL
            )
            OR
            (
                status <> 'CANCELLED'
                AND cancelled_at IS NULL
                AND cancelled_by_membership_id IS NULL
                AND cancellation_reason IS NULL
            )
        ),

    INDEX idx_production_orders_location_status (
        business_id,
        location_id,
        status,
        planned_for
    ),

    INDEX idx_production_orders_recipe (
        business_id,
        recipe_id,
        created_at
    ),

    INDEX idx_production_orders_created (
        business_id,
        created_at
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS production_order_inputs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    production_order_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    item_name_snapshot VARCHAR(150) NOT NULL,
    item_sku_snapshot VARCHAR(50) NULL,
    base_unit_snapshot VARCHAR(30) NOT NULL,

    planned_quantity DECIMAL(18, 3) NOT NULL,
    actual_quantity DECIMAL(18, 3) NULL,

    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_order_inputs
        PRIMARY KEY (id),

    CONSTRAINT uq_production_order_inputs_item
        UNIQUE (
            business_id,
            production_order_id,
            inventory_item_id
        ),

    CONSTRAINT fk_production_order_inputs_order
        FOREIGN KEY (
            business_id,
            production_order_id
        )
        REFERENCES production_orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_production_order_inputs_item
        FOREIGN KEY (
            business_id,
            inventory_item_id
        )
        REFERENCES inventory_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_production_order_inputs_planned
        CHECK (planned_quantity > 0),

    CONSTRAINT chk_production_order_inputs_actual
        CHECK (
            actual_quantity IS NULL
            OR actual_quantity > 0
        ),

    CONSTRAINT chk_production_order_inputs_unit
        CHECK (
            base_unit_snapshot IN (
                'UNIT',
                'GRAM',
                'KILOGRAM',
                'MILLILITER',
                'LITER',
                'PORTION',
                'PACKAGE'
            )
        ),

    INDEX idx_production_order_inputs_order (
        business_id,
        production_order_id,
        id
    )
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS production_order_outputs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,
    production_order_id BIGINT UNSIGNED NOT NULL,
    inventory_item_id BIGINT UNSIGNED NOT NULL,

    item_name_snapshot VARCHAR(150) NOT NULL,
    item_sku_snapshot VARCHAR(50) NULL,
    base_unit_snapshot VARCHAR(30) NOT NULL,

    planned_quantity DECIMAL(18, 3) NOT NULL,
    actual_quantity DECIMAL(18, 3) NULL,

    cost_allocation_percentage
        DECIMAL(9, 6) NOT NULL,

    notes VARCHAR(500) NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_order_outputs
        PRIMARY KEY (id),

    CONSTRAINT uq_production_order_outputs_item
        UNIQUE (
            business_id,
            production_order_id,
            inventory_item_id
        ),

    CONSTRAINT fk_production_order_outputs_order
        FOREIGN KEY (
            business_id,
            production_order_id
        )
        REFERENCES production_orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE CASCADE,

    CONSTRAINT fk_production_order_outputs_item
        FOREIGN KEY (
            business_id,
            inventory_item_id
        )
        REFERENCES inventory_items (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_production_order_outputs_planned
        CHECK (planned_quantity > 0),

    CONSTRAINT chk_production_order_outputs_actual
        CHECK (
            actual_quantity IS NULL
            OR actual_quantity > 0
        ),

    CONSTRAINT chk_production_order_outputs_allocation
        CHECK (
            cost_allocation_percentage > 0
            AND cost_allocation_percentage <= 100
        ),

    CONSTRAINT chk_production_order_outputs_unit
        CHECK (
            base_unit_snapshot IN (
                'UNIT',
                'GRAM',
                'KILOGRAM',
                'MILLILITER',
                'LITER',
                'PORTION',
                'PACKAGE'
            )
        ),

    INDEX idx_production_order_outputs_order (
        business_id,
        production_order_id,
        id
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE production_orders;
SHOW CREATE TABLE production_order_inputs;
SHOW CREATE TABLE production_order_outputs;


-- ==============================================================
-- ARCHIVO: 053_create_production_order_waste_records.sql
-- ==============================================================

USE sazora_db;

-- =========================================================
-- Migración 053
-- Desperdicios explícitos asociados a órdenes de producción
-- =========================================================

CREATE TABLE IF NOT EXISTS production_order_waste_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    production_order_id BIGINT UNSIGNED NOT NULL,
    inventory_movement_id BIGINT UNSIGNED NOT NULL,

    reason VARCHAR(500) NOT NULL,

    recorded_by_membership_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_production_order_waste_records
        PRIMARY KEY (id),

    CONSTRAINT uq_production_order_waste_business_record
        UNIQUE (
            business_id,
            id
        ),

    /*
     * Un movimiento de inventario solo puede representar
     * un registro de desperdicio de producción.
     */
    CONSTRAINT uq_production_order_waste_movement
        UNIQUE (
            business_id,
            inventory_movement_id
        ),

    CONSTRAINT fk_production_order_waste_order
        FOREIGN KEY (
            business_id,
            production_order_id
        )
        REFERENCES production_orders (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_order_waste_movement
        FOREIGN KEY (
            business_id,
            inventory_movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_production_order_waste_recorded_by
        FOREIGN KEY (
            business_id,
            recorded_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_production_order_waste_reason
        CHECK (
            CHAR_LENGTH(TRIM(reason)) >= 3
        ),

    INDEX idx_production_order_waste_order (
        business_id,
        production_order_id,
        created_at
    ),

    INDEX idx_production_order_waste_responsible (
        business_id,
        recorded_by_membership_id,
        created_at
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE production_order_waste_records;


-- ==============================================================
-- ARCHIVO: 054_create_inventory_transfers.sql
-- ==============================================================

USE sazora_db;

-- Permitir movimientos de transferencia.
ALTER TABLE inventory_movements
    DROP CHECK chk_inventory_movements_type;

ALTER TABLE inventory_movements
    ADD CONSTRAINT chk_inventory_movements_type
        CHECK (
            movement_type IN (
                'OPENING',
                'PURCHASE',
                'PRODUCTION',
                'SALE',
                'ADJUSTMENT',
                'WASTE',
                'RETURN',
                'REVERSAL',
                'TRANSFER'
            )
        );

-- Permitir que el costo promedio quede NULL cuando una salida
-- deja el saldo exactamente en cero.
ALTER TABLE inventory_movement_lines
    DROP CHECK chk_inventory_movement_line_cost_data;

ALTER TABLE inventory_movement_lines
    ADD CONSTRAINT chk_inventory_movement_line_cost_data
        CHECK (
            (
                cost_status = 'UNVALUED_LEGACY'
                AND unit_cost IS NULL
                AND total_cost IS NULL
                AND average_unit_cost_before IS NULL
                AND average_unit_cost_after IS NULL
                AND inventory_value_before IS NULL
                AND inventory_value_after IS NULL
            )
            OR
            (
                cost_status = 'VALUED'
                AND unit_cost IS NOT NULL
                AND total_cost IS NOT NULL
                AND inventory_value_after IS NOT NULL
                AND (
                    (
                        balance_after = 0
                        AND average_unit_cost_after IS NULL
                        AND inventory_value_after = 0
                    )
                    OR
                    (
                        average_unit_cost_after IS NOT NULL
                    )
                )
            )
        );

CREATE TABLE inventory_transfers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    business_id BIGINT UNSIGNED NOT NULL,

    source_location_id BIGINT UNSIGNED NOT NULL,
    destination_location_id BIGINT UNSIGNED NOT NULL,

    source_movement_id BIGINT UNSIGNED NULL,
    destination_movement_id BIGINT UNSIGNED NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',

    external_reference VARCHAR(120) NULL,
    notes VARCHAR(500) NOT NULL,

    created_by_membership_id BIGINT UNSIGNED NOT NULL,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at DATETIME(3) NULL,

    CONSTRAINT pk_inventory_transfers
        PRIMARY KEY (id),

    CONSTRAINT uq_inventory_transfers_business_transfer
        UNIQUE (business_id, id),

    CONSTRAINT uq_inventory_transfers_source_movement
        UNIQUE (business_id, source_movement_id),

    CONSTRAINT uq_inventory_transfers_destination_movement
        UNIQUE (business_id, destination_movement_id),

    CONSTRAINT fk_inventory_transfers_source_location
        FOREIGN KEY (
            business_id,
            source_location_id
        )
        REFERENCES business_locations (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_transfers_destination_location
        FOREIGN KEY (
            business_id,
            destination_location_id
        )
        REFERENCES business_locations (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_transfers_source_movement
        FOREIGN KEY (
            business_id,
            source_movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_transfers_destination_movement
        FOREIGN KEY (
            business_id,
            destination_movement_id
        )
        REFERENCES inventory_movements (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_transfers_membership
        FOREIGN KEY (
            business_id,
            created_by_membership_id
        )
        REFERENCES business_memberships (
            business_id,
            id
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_transfers_locations
        CHECK (
            source_location_id <> destination_location_id
        ),

    CONSTRAINT chk_inventory_transfers_status
        CHECK (
            status IN (
                'PROCESSING',
                'COMPLETED'
            )
        ),

    CONSTRAINT chk_inventory_transfers_completion
        CHECK (
            (
                status = 'PROCESSING'
                AND source_movement_id IS NULL
                AND destination_movement_id IS NULL
                AND completed_at IS NULL
            )
            OR
            (
                status = 'COMPLETED'
                AND source_movement_id IS NOT NULL
                AND destination_movement_id IS NOT NULL
                AND completed_at IS NOT NULL
            )
        ),

    CONSTRAINT chk_inventory_transfers_notes
        CHECK (
            CHAR_LENGTH(TRIM(notes)) >= 3
        ),

    INDEX idx_inventory_transfers_source (
        business_id,
        source_location_id,
        created_at
    ),

    INDEX idx_inventory_transfers_destination (
        business_id,
        destination_location_id,
        created_at
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE inventory_transfers;


-- --------------------------------------------------------------------------
-- ==============================================================
-- ARCHIVO: 055_create_permissions.sql
-- ==============================================================
-- Migración 055: catálogo de permisos y relación entre roles y permisos.

USE sazora_db;

-- Agrega el rol encargado de las operaciones de caja.

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'CASHIER',
    'Caja',
    'Gestiona cobros, aperturas, cierres y movimientos de caja.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'CASHIER'
);

-- Agrega el rol encargado de las operaciones de inventario.

INSERT INTO roles (
    code,
    name,
    description
)
SELECT
    'INVENTORY_MANAGER',
    'Inventario',
    'Gestiona existencias, compras, movimientos, transferencias y conciliaciones.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'INVENTORY_MANAGER'
);

-- Catálogo global de permisos disponibles en la aplicación.

CREATE TABLE IF NOT EXISTS permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    code VARCHAR(120) NOT NULL,
    module VARCHAR(60) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255) NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_permissions
        PRIMARY KEY (id),

    CONSTRAINT uq_permissions_code
        UNIQUE (code),

    CONSTRAINT chk_permissions_code_not_blank
        CHECK (
            CHAR_LENGTH(TRIM(code)) > 0
        ),

    CONSTRAINT chk_permissions_module_not_blank
        CHECK (
            CHAR_LENGTH(TRIM(module)) > 0
        ),

    CONSTRAINT chk_permissions_name_not_blank
        CHECK (
            CHAR_LENGTH(TRIM(name)) > 0
        ),

    INDEX idx_permissions_module_active (
        module,
        is_active
    )
) ENGINE = InnoDB;

-- Relación de permisos asignados a cada rol.

CREATE TABLE IF NOT EXISTS role_permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),

    CONSTRAINT pk_role_permissions
        PRIMARY KEY (id),

    CONSTRAINT uq_role_permissions_role_permission
        UNIQUE (
            role_id,
            permission_id
        ),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES roles (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES permissions (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    INDEX idx_role_permissions_permission (
        permission_id,
        is_active
    )
) ENGINE = InnoDB;

SHOW CREATE TABLE permissions;
SHOW CREATE TABLE role_permissions;

-- --------------------------------------------------------------------------
-- ==============================================================
-- ARCHIVO: 001_seed_roles.sql
-- ==============================================================
-- Seed 001: roles iniciales de Sazora.
--
-- Este seed puede ejecutarse nuevamente sin duplicar roles.

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

INSERT INTO roles (code, name, description)
SELECT
    'PUBLIC_ORDER_MANAGER',
    'Gestor de pedidos públicos',
    'Gestiona solicitudes creadas desde el menú público.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'PUBLIC_ORDER_MANAGER'
);

INSERT INTO roles (code, name, description)
SELECT
    'DELIVERY_DRIVER',
    'Domiciliario',
    'Recibe, transporta y entrega pedidos a domicilio.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'DELIVERY_DRIVER'
);

INSERT INTO roles (code, name, description)
SELECT
    'PRODUCTION',
    'Producción',
    'Gestiona procesos de producción, productos terminados y operaciones de planta.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'PRODUCTION'
);

INSERT INTO roles (code, name, description)
SELECT
    'CASHIER',
    'Caja',
    'Gestiona cobros, aperturas, cierres y movimientos de caja.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'CASHIER'
);

INSERT INTO roles (code, name, description)
SELECT
    'INVENTORY_MANAGER',
    'Inventario',
    'Gestiona existencias, compras, movimientos, transferencias y conciliaciones.'
WHERE NOT EXISTS (
    SELECT 1
    FROM roles
    WHERE code = 'INVENTORY_MANAGER'
);

SELECT
    id,
    code,
    name,
    description,
    is_active
FROM roles
ORDER BY id;

-- --------------------------------------------------------------------------
-- ==============================================================
-- ARCHIVO: 002_seed_permissions.sql
-- ==============================================================
-- Seed 002: catálogo inicial de permisos y asignaciones por rol.

USE sazora_db;

INSERT INTO permissions (
    code,
    module,
    name,
    description
)
VALUES
    (
        'dashboard.read',
        'dashboard',
        'Consultar resumen',
        'Permite consultar el resumen operativo del negocio.'
    ),

    (
        'business.settings.read',
        'business',
        'Consultar configuración',
        'Permite consultar la configuración del negocio.'
    ),
    (
        'business.settings.manage',
        'business',
        'Administrar configuración',
        'Permite modificar la configuración del negocio.'
    ),
    (
        'organization.profile.read',
        'business',
        'Consultar perfil fiscal',
        'Permite consultar el perfil organizacional y fiscal.'
    ),
    (
        'organization.profile.manage',
        'business',
        'Administrar perfil fiscal',
        'Permite modificar el perfil organizacional y fiscal.'
    ),

    (
        'employees.read',
        'employees',
        'Consultar empleados',
        'Permite consultar empleados, roles y asignaciones.'
    ),
    (
        'employees.manage',
        'employees',
        'Administrar empleados',
        'Permite crear y modificar empleados, roles y ubicaciones.'
    ),

    (
        'locations.read',
        'locations',
        'Consultar ubicaciones',
        'Permite consultar ubicaciones del negocio.'
    ),
    (
        'locations.manage',
        'locations',
        'Administrar ubicaciones',
        'Permite crear y modificar ubicaciones.'
    ),

    (
        'catalog.read',
        'catalog',
        'Consultar catálogo',
        'Permite consultar categorías y productos.'
    ),
    (
        'catalog.manage',
        'catalog',
        'Administrar catálogo',
        'Permite crear y modificar categorías, productos y combos.'
    ),

    (
        'tables.read',
        'tables',
        'Consultar mesas',
        'Permite consultar mesas del punto de venta.'
    ),
    (
        'tables.manage',
        'tables',
        'Administrar mesas',
        'Permite crear y modificar mesas.'
    ),

    (
        'orders.read',
        'orders',
        'Consultar pedidos',
        'Permite consultar pedidos y su historial.'
    ),
    (
        'orders.manage',
        'orders',
        'Administrar pedidos',
        'Permite crear y modificar pedidos y sus productos.'
    ),
    (
        'orders.cancel',
        'orders',
        'Cancelar pedidos',
        'Permite cancelar pedidos o cantidades de productos.'
    ),
    (
        'orders.close',
        'orders',
        'Cerrar pedidos',
        'Permite cerrar y entregar pedidos.'
    ),

    (
        'kitchen.settings.read',
        'kitchen',
        'Consultar configuración de cocina',
        'Permite consultar áreas y configuración de cocina.'
    ),
    (
        'kitchen.settings.manage',
        'kitchen',
        'Administrar configuración de cocina',
        'Permite modificar áreas y configuración de cocina.'
    ),
    (
        'kitchen.tickets.read',
        'kitchen',
        'Consultar comandas',
        'Permite consultar comandas de cocina.'
    ),
    (
        'kitchen.tickets.update',
        'kitchen',
        'Actualizar comandas',
        'Permite modificar estados de comandas y productos.'
    ),
    (
        'kitchen.tickets.print',
        'kitchen',
        'Imprimir comandas',
        'Permite imprimir y reimprimir comandas.'
    ),

    (
        'inventory.items.read',
        'inventory',
        'Consultar artículos',
        'Permite consultar el catálogo de artículos de inventario.'
    ),
    (
        'inventory.items.manage',
        'inventory',
        'Administrar artículos',
        'Permite crear y modificar artículos de inventario.'
    ),
    (
        'inventory.balances.read',
        'inventory',
        'Consultar existencias',
        'Permite consultar existencias por ubicación autorizada.'
    ),
    (
        'inventory.movements.read',
        'inventory',
        'Consultar movimientos',
        'Permite consultar movimientos de inventario.'
    ),
    (
        'inventory.movements.create',
        'inventory',
        'Registrar movimientos',
        'Permite registrar movimientos manuales de inventario.'
    ),
    (
        'inventory.purchases.read',
        'inventory',
        'Consultar compras',
        'Permite consultar compras de inventario.'
    ),
    (
        'inventory.purchases.create',
        'inventory',
        'Registrar compras',
        'Permite registrar compras e ingresos de inventario.'
    ),
    (
        'inventory.transfers.create',
        'inventory',
        'Crear transferencias',
        'Permite transferir inventario entre ubicaciones.'
    ),
    (
        'inventory.valuation.manage',
        'inventory',
        'Administrar valoración',
        'Permite registrar y modificar la valoración inicial.'
    ),
    (
        'inventory.reports.read',
        'inventory',
        'Consultar informes',
        'Permite consultar resumen, Kardex y costos.'
    ),
    (
        'inventory.reconciliation.read',
        'inventory',
        'Consultar conciliación',
        'Permite consultar diferencias de conciliación.'
    ),
    (
        'inventory.reconciliation.execute',
        'inventory',
        'Ejecutar conciliación',
        'Permite ejecutar ajustes de conciliación cuando se implemente.'
    ),
    (
        'inventory.links.manage',
        'inventory',
        'Configurar productos e inventario',
        'Permite vincular productos comerciales con inventario.'
    ),

    (
        'production.recipes.read',
        'production',
        'Consultar recetas',
        'Permite consultar recetas de producción.'
    ),
    (
        'production.recipes.manage',
        'production',
        'Administrar recetas',
        'Permite crear y modificar recetas.'
    ),
    (
        'production.quick.create',
        'production',
        'Registrar producción rápida',
        'Permite registrar transformaciones de producción rápida.'
    ),
    (
        'production.orders.read',
        'production',
        'Consultar órdenes de producción',
        'Permite consultar órdenes de producción.'
    ),
    (
        'production.orders.manage',
        'production',
        'Administrar órdenes de producción',
        'Permite crear, planificar, modificar y cancelar órdenes.'
    ),
    (
        'production.orders.execute',
        'production',
        'Ejecutar órdenes de producción',
        'Permite iniciar y completar órdenes de producción.'
    ),
    (
        'production.waste.read',
        'production',
        'Consultar desperdicios',
        'Permite consultar desperdicios de producción.'
    ),
    (
        'production.waste.create',
        'production',
        'Registrar desperdicios',
        'Permite registrar desperdicios de producción.'
    ),
    (
        'production.reports.read',
        'production',
        'Consultar informes de producción',
        'Permite consultar rendimiento e informes de producción.'
    ),

    (
        'sales.reports.read',
        'sales',
        'Consultar informes de ventas',
        'Permite consultar informes comerciales y operativos.'
    ),

    (
        'public_menu.manage',
        'public_orders',
        'Administrar menú público',
        'Permite modificar la configuración del menú público.'
    ),
    (
        'public_orders.read',
        'public_orders',
        'Consultar pedidos públicos',
        'Permite consultar solicitudes creadas desde el menú público.'
    ),
    (
        'public_orders.manage',
        'public_orders',
        'Administrar pedidos públicos',
        'Permite aceptar, rechazar y gestionar pedidos públicos.'
    ),
    (
        'public_orders.assign',
        'public_orders',
        'Asignar pedidos públicos',
        'Permite asignar responsables de pedidos públicos.'
    ),

    (
        'deliveries.read',
        'deliveries',
        'Consultar domicilios',
        'Permite consultar domicilios.'
    ),
    (
        'deliveries.manage',
        'deliveries',
        'Administrar domicilios',
        'Permite asignar y administrar domicilios.'
    ),
    (
        'deliveries.execute',
        'deliveries',
        'Ejecutar domicilios',
        'Permite actualizar el estado de un domicilio asignado.'
    ),

    (
        'cash.sessions.read',
        'cash',
        'Consultar sesiones de caja',
        'Permite consultar aperturas y cierres de caja.'
    ),
    (
        'cash.sessions.open',
        'cash',
        'Abrir caja',
        'Permite abrir una sesión de caja.'
    ),
    (
        'cash.sessions.close',
        'cash',
        'Cerrar caja',
        'Permite cerrar y arquear una sesión de caja.'
    ),
    (
        'cash.transactions.create',
        'cash',
        'Registrar movimientos de caja',
        'Permite registrar cobros, ingresos y egresos autorizados.'
    ),
    (
        'cash.reports.read',
        'cash',
        'Consultar informes de caja',
        'Permite consultar informes y cierres de caja.'
    )
ON DUPLICATE KEY UPDATE
    module = VALUES(module),
    name = VALUES(name),
    description = VALUES(description),
    is_active = TRUE;

-- ADMIN recibe todos los permisos activos.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
CROSS JOIN permissions AS p
WHERE
    r.code = 'ADMIN'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- INVENTORY_MANAGER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'dashboard.read',
        'locations.read',
        'catalog.read',
        'inventory.items.read',
        'inventory.items.manage',
        'inventory.balances.read',
        'inventory.movements.read',
        'inventory.movements.create',
        'inventory.purchases.read',
        'inventory.purchases.create',
        'inventory.transfers.create',
        'inventory.valuation.manage',
        'inventory.reports.read',
        'inventory.reconciliation.read',
        'inventory.reconciliation.execute',
        'inventory.links.manage'
    )
WHERE
    r.code = 'INVENTORY_MANAGER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- PRODUCTION.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'inventory.items.read',
        'inventory.balances.read',
        'production.recipes.read',
        'production.quick.create',
        'production.orders.read',
        'production.orders.execute',
        'production.waste.read',
        'production.waste.create',
        'production.reports.read'
    )
WHERE
    r.code = 'PRODUCTION'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- CASHIER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'dashboard.read',
        'catalog.read',
        'tables.read',
        'orders.read',
        'orders.manage',
        'orders.close',
        'cash.sessions.read',
        'cash.sessions.open',
        'cash.sessions.close',
        'cash.transactions.create',
        'cash.reports.read'
    )
WHERE
    r.code = 'CASHIER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- WAITER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'catalog.read',
        'tables.read',
        'orders.read',
        'orders.manage',
        'orders.cancel',
        'orders.close',
        'kitchen.settings.read',
        'kitchen.tickets.read',
        'kitchen.tickets.update',
        'kitchen.tickets.print'
    )
WHERE
    r.code = 'WAITER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- KITCHEN.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'catalog.read',
        'kitchen.settings.read',
        'kitchen.tickets.read',
        'kitchen.tickets.update',
        'kitchen.tickets.print'
    )
WHERE
    r.code = 'KITCHEN'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- PUBLIC_ORDER_MANAGER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'catalog.read',
        'public_orders.read',
        'public_orders.manage',
        'public_orders.assign',
        'deliveries.read',
        'deliveries.manage'
    )
WHERE
    r.code = 'PUBLIC_ORDER_MANAGER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

-- DELIVERY_DRIVER.

INSERT IGNORE INTO role_permissions (
    role_id,
    permission_id
)
SELECT
    r.id,
    p.id
FROM roles AS r
INNER JOIN permissions AS p
    ON p.code IN (
        'deliveries.read',
        'deliveries.execute'
    )
WHERE
    r.code = 'DELIVERY_DRIVER'
    AND r.is_active = TRUE
    AND p.is_active = TRUE;

SELECT
    r.code AS role_code,
    p.code AS permission_code,
    p.module
FROM role_permissions AS rp
INNER JOIN roles AS r
    ON r.id = rp.role_id
INNER JOIN permissions AS p
    ON p.id = rp.permission_id
WHERE
    rp.is_active = TRUE
    AND r.is_active = TRUE
    AND p.is_active = TRUE
ORDER BY
    r.code,
    p.module,
    p.code;

-- --------------------------------------------------------------------------