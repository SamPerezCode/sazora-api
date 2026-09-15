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
