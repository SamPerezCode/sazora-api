# Acciones masivas de comandas

## 1. Objetivo

Este módulo permite avanzar en una sola operación todos los productos aplicables
de una comanda. De esta manera, cocina no necesita cambiar individualmente el
estado de cada producto cuando toda la comanda inicia, queda lista o se entrega
al mismo tiempo.

La operación conserva las reglas ya utilizadas por el endpoint individual y
registra cada transición en el historial de preparación.

## 2. Endpoint

```http
PATCH /api/kitchen-tickets/:kitchenTicketId/status
```

Nombre utilizado en Postman:

```text
PATCH Cambiar estado de comanda
```

Carpeta de Postman:

```text
Kitchen Tickets
```

## 3. Autorización

El endpoint requiere autenticación y admite los roles:

- `ADMIN`.
- `KITCHEN`.
- `WAITER`.

El `businessId` y la membresía responsable se obtienen del token. El cliente no
puede seleccionar libremente el negocio ni la persona que realiza el cambio.

## 4. Identificadores

`kitchenTicketId` identifica la comanda completa. No debe confundirse con:

- `orderId`, que identifica la orden.
- `orderItemId`, que identifica una línea comercial de la orden.
- `kitchenTicketItemId`, que identifica un producto dentro de la comanda.

Ejemplo:

```json
{
  "id": "1",
  "orderId": "2",
  "items": [
    {
      "id": "3",
      "orderItemId": "3"
    }
  ]
}
```

En este ejemplo, `1` es el `kitchenTicketId` y `3` es el
`kitchenTicketItemId`.

## 5. Cuerpo de la solicitud

```json
{
  "status": "IN_PREPARATION"
}
```

Los estados admitidos son:

- `IN_PREPARATION`.
- `READY`.
- `DELIVERED`.

## 6. Reglas de transición

### IN_PREPARATION

La operación cambia a `IN_PREPARATION` los productos `PREPARE_TO_ORDER` que
continúan en `PENDING`.

Los productos `READY_TO_SERVE` no retroceden a preparación porque comienzan
directamente en `READY`.

### READY

La operación cambia a `READY` los productos que se encuentran en
`IN_PREPARATION`.

Si todavía existe un producto activo en `PENDING`, la operación completa se
rechaza. Esto evita saltar la transición obligatoria de preparación.

### DELIVERED

La operación cambia a `DELIVERED` todos los productos activos de la comanda.
Para ejecutarla, todos esos productos deben estar en `READY`.

Los elementos que ya están en `DELIVERED` o `CANCELLED` no se modifican.

## 7. Atomicidad e historial

El repositorio bloquea la orden y los productos de la comanda durante la
operación. Las actualizaciones y los registros de
`kitchen_item_status_history` se ejecutan dentro de una sola transacción.

Si una transición no es válida o una consulta falla, se ejecuta `ROLLBACK` y
ningún producto queda actualizado parcialmente.

Cada producto modificado conserva:

- Estado anterior.
- Estado nuevo.
- Membresía responsable.
- Fecha del cambio.
- Marca temporal correspondiente: `startedAt`, `readyAt` o `deliveredAt`.

Cambiar estados operativos no incrementa `currentVersion`, porque la versión de
la comanda representa cambios en su contenido, no el avance de preparación.

## 8. Entrega automática de la orden

Cuando la operación solicitada es `DELIVERED`, el backend consulta todos los
productos de todas las comandas pertenecientes a la orden.

Si ya no quedan productos en `PENDING`, `IN_PREPARATION` o `READY`, la orden
cambia automáticamente de `CONFIRMED` a `DELIVERED` y se registra la transición
en `order_status_history`.

Una orden con otra comanda todavía pendiente conserva el estado `CONFIRMED`.

## 9. Respuesta exitosa

```json
{
  "status": "success",
  "data": {
    "orderId": "5",
    "items": [
      {
        "id": "10",
        "orderItemId": "18",
        "productName": "Crepe de pollo",
        "fulfillmentMode": "PREPARE_TO_ORDER",
        "quantity": 2,
        "notes": null,
        "preparationStatus": "IN_PREPARATION",
        "startedAt": "2026-09-23T15:00:00.000Z",
        "readyAt": null,
        "deliveredAt": null,
        "cancelledAt": null,
        "createdAt": "2026-09-23T14:55:00.000Z",
        "updatedAt": "2026-09-23T15:00:00.000Z"
      }
    ],
    "orderDelivered": false
  }
}
```

`items` contiene únicamente los productos modificados por la solicitud.
`orderDelivered` indica si la misma operación completó también la orden.

## 10. Errores principales

### KITCHEN_TICKET_NOT_FOUND

La comanda no existe dentro del negocio autenticado.

### ORDER_NOT_CONFIRMED

La orden asociada ya no está en `CONFIRMED`. Una orden `DELIVERED`, `CLOSED` o
`CANCELLED` no puede regresar al flujo de preparación.

### INVALID_KITCHEN_TICKET_STATUS_TRANSITION

La comanda no puede avanzar al estado solicitado. Puede ocurrir cuando:

- Se intenta marcar `READY` mientras existen productos en `PENDING`.
- Se intenta entregar mientras algún producto no está listo.
- No existe ningún producto al que pueda aplicarse la transición.
- La comanda ya completó esa etapa.

## 11. Eventos de tiempo real

Por cada producto modificado se emite:

```text
kitchen-ticket:item-status-updated
```

Si la operación completa la orden también se emite:

```text
order:status-updated
```

Esto permite que las pantallas de administración, meseros y cocina reflejen el
cambio sin consultar manualmente los endpoints.

## 12. Archivos del módulo

- `src/modules/kitchen-tickets/schemas/update-kitchen-ticket-status.schema.ts`.
- `src/modules/kitchen-tickets/repositories/update-kitchen-ticket-status.repository.ts`.
- `src/modules/kitchen-tickets/services/update-kitchen-ticket-status.service.ts`.
- `src/modules/kitchen-tickets/controllers/kitchen-ticket.controller.ts`.
- `src/modules/kitchen-tickets/kitchen-ticket.routes.ts`.

## 13. Verificación

- [x] Los archivos están dentro del módulo `kitchen-tickets`.
- [x] La comprobación de tipos finaliza correctamente.
- [x] ESLint finaliza correctamente.
- [x] El endpoint distingue la comanda de sus productos individuales.
- [x] Probar la secuencia masiva `IN_PREPARATION → READY → DELIVERED` sobre una
      orden confirmada.
- [x] Confirmar en Socket.IO los eventos individuales y la entrega automática
      de la orden.

## 14. Próximo módulo

El siguiente bloque implementará el registro persistente de impresiones y
reimpresiones de comandas. Utilizará la tabla `kitchen_ticket_prints`, conservará
una copia inmutable del contenido impreso y preparará la integración futura con
un agente local de impresión térmica.
