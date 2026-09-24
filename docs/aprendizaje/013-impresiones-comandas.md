# Impresiones y reimpresiones de comandas

## 1. Objetivo

Este módulo registra las impresiones y reimpresiones de una comanda con una
copia inmutable del contenido correspondiente a la versión impresa.

El backend todavía no se conecta directamente con una impresora física. Su
responsabilidad actual es construir el contenido, conservar la trazabilidad y
permitir recuperar exactamente una versión anterior. La integración física se
realizará posteriormente mediante un agente local compatible con la impresora
seleccionada por el negocio.

## 2. Tabla utilizada

El módulo utiliza la tabla existente:

```text
kitchen_ticket_prints
```

Cada registro conserva:

- Negocio.
- Comanda.
- Membresía que solicitó la impresión.
- Versión de la comanda.
- Tipo de impresión.
- Motivo, cuando corresponde.
- Nombre opcional de la impresora.
- Copia JSON del contenido.
- Fecha de creación.

No fue necesaria una migración adicional.

## 3. Tipos de impresión

### INITIAL

Representa la primera impresión de una comanda en versión `1`. No requiere
motivo.

### MODIFICATION

Representa la primera impresión de una versión superior a `1`, generada después
de adiciones o cancelaciones. Requiere un motivo.

### REPRINT

Representa una nueva impresión de una copia ya registrada. Conserva la misma
versión y el mismo `contentSnapshot`, y requiere explicar el motivo de la
reimpresión.

## 4. Registrar la impresión de la versión actual

```http
POST /api/kitchen-tickets/:kitchenTicketId/prints
```

Nombre en Postman:

```text
POST Registrar impresión de comanda
```

Roles permitidos:

- `ADMIN`.
- `KITCHEN`.

Ejemplo sin una impresora configurada:

```json
{
  "reason": null,
  "printerName": null
}
```

`printerName` es opcional y solamente funciona como metadato. No establece una
conexión física con el dispositivo.

Para una versión superior a `1` debe enviarse un motivo:

```json
{
  "reason": "Se imprimen los cambios de la versión actual",
  "printerName": null
}
```

El backend determina `INITIAL` o `MODIFICATION`; el cliente no puede escoger el
tipo libremente.

## 5. Evitar duplicados

Una versión solamente puede tener un registro canónico `INITIAL` o
`MODIFICATION`.

Intentar registrar nuevamente esa misma versión responde:

```text
409 KITCHEN_TICKET_VERSION_ALREADY_PRINTED
```

Después de la primera impresión, cualquier copia adicional debe utilizar el
endpoint de reimpresión.

## 6. Consultar el historial

```http
GET /api/kitchen-tickets/:kitchenTicketId/prints
```

Nombre en Postman:

```text
GET Consultar impresiones de comanda
```

El resultado se ordena desde el registro más reciente y puede contener
impresiones `INITIAL`, `MODIFICATION` y `REPRINT`.

## 7. Reimprimir una copia registrada

```http
POST /api/kitchen-tickets/:kitchenTicketId/prints/:kitchenTicketPrintId/reprint
```

Nombre en Postman:

```text
POST Reimprimir comanda
```

Ejemplo:

```json
{
  "reason": "Comanda dañada durante la preparación",
  "printerName": null
}
```

El backend localiza el registro indicado por `kitchenTicketPrintId`, reutiliza
exactamente su `contentSnapshot` y crea un evento nuevo de tipo `REPRINT`.

Una reimpresión:

- No modifica la comanda.
- No incrementa `currentVersion`.
- No reconstruye datos usando el estado actual.
- No altera el registro original.
- Exige un motivo.

## 8. Contenido de la copia inmutable

`contentSnapshot` conserva:

- Negocio, orden y comanda.
- Nombre comercial del negocio utilizado como encabezado.
- Texto configurable para el pie de la comanda.
- Área de preparación.
- Versión de la comanda.
- Modalidad de servicio.
- Mesa, cuando corresponde.
- Notas de la orden.
- Fecha de generación.
- Productos, cantidades y notas.
- Modo operativo de cada producto.
- Estado de preparación registrado al generar la copia.

Esto permite reimprimir una versión histórica aunque el catálogo, la orden o la
comanda cambien posteriormente.

El encabezado se obtiene de `businesses.name` y el pie se obtiene de
`business_settings.kitchen_ticket_footer` en el momento de crear la copia. La
firma `SAZORA` es una identificación fija de la plataforma y no forma parte de
la configuración editable del negocio.

Las copias creadas antes de incorporar estos campos conservan su estructura
original. No deben reescribirse, porque el historial de impresión es inmutable.

## 9. Aislamiento multiempresa

Todos los endpoints obtienen `businessId` y `membershipId` desde la sesión
autenticada. Las consultas combinan el negocio con los identificadores de la
comanda y de la impresión, evitando acceder a registros de otro establecimiento.

## 10. Transacciones

La creación de una impresión bloquea la comanda mientras comprueba la versión y
la existencia de un registro canónico. La copia y el registro se crean dentro
de una transacción.

La reimpresión también bloquea el registro de origen durante la lectura y crea
la nueva fila en la misma transacción.

## 11. Alcance actual

El registro confirma que Sazora generó y conservó el contenido de impresión. No
confirma todavía que una impresora física haya terminado el trabajo.

El futuro agente local deberá incorporar una cola técnica con estados como
`PENDING`, `PROCESSING`, `PRINTED` y `FAILED`, además de reintentos. Esa etapa se
implementará cuando se defina el modelo y el tipo de conexión de la impresora
térmica del piloto.

## 12. Archivos del módulo

- `src/modules/kitchen-tickets/kitchen-ticket-print.types.ts`.
- `src/modules/kitchen-tickets/schemas/kitchen-ticket-print.schema.ts`.
- `src/modules/kitchen-tickets/repositories/kitchen-ticket-print.repository.ts`.
- `src/modules/kitchen-tickets/services/kitchen-ticket-print.service.ts`.
- `src/modules/kitchen-tickets/controllers/kitchen-ticket.controller.ts`.
- `src/modules/kitchen-tickets/kitchen-ticket.routes.ts`.

## 13. Pruebas completadas

- [x] Formato de código.
- [x] Comprobación de tipos.
- [x] ESLint.
- [x] Compilación.
- [x] Registro de una impresión inicial.
- [x] Persistencia del `contentSnapshot`.
- [x] Consulta del historial de impresiones.
- [x] Registro de una reimpresión con motivo.
- [x] Conservación de la versión en una reimpresión.
- [x] Rechazo de una segunda impresión canónica de la misma versión.

## 14. Resultado

Sazora puede auditar qué versión de una comanda se imprimió, quién solicitó la
impresión, qué contenido fue generado y por qué se realizó una reimpresión. El
diseño queda preparado para conectar posteriormente una cola de impresión con
un agente local sin perder el historial funcional ya implementado.
