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
