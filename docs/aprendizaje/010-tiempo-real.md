# Tiempo real con Socket.IO

## 1. Objetivo

El módulo de tiempo real permite que las pantallas de administración, meseros y cocina reciban cambios operativos sin consultar manualmente los endpoints de forma repetitiva.

Socket.IO no reemplaza la API REST:

- REST ejecuta operaciones y carga el estado actual.
- Socket.IO notifica que una operación terminó correctamente.
- Después de una reconexión, el frontend debe volver a consultar REST para recuperar cualquier evento que haya ocurrido mientras estuvo desconectado.

Los eventos se emiten después de que la operación correspondiente termina correctamente y la transacción de base de datos queda confirmada.

## 2. Conexión

### Desarrollo

```text
ws://localhost:3000
```

### Producción

```text
wss://api.dominio.com
```

El cliente debe usar Socket.IO versión 4. No debe utilizar un cliente WebSocket básico, porque Socket.IO tiene su propio protocolo.

El path actual es:

```text
/socket.io
```

## 3. Autenticación

La conexión requiere un access token válido. El frontend debe enviarlo mediante `auth.token`:

```ts
import { io } from "socket.io-client";

const socket = io(API_URL, {
  autoConnect: false,
  auth: {
    token: accessToken,
  },
});
```

Postman también puede enviarlo mediante el encabezado:

```text
Authorization: Bearer <accessToken>
```

La API verifica:

- Firma y vencimiento del token.
- Usuario.
- Negocio.
- Membresía.
- Versión vigente de autenticación.
- Estado activo de la sesión.
- Roles actuales de la membresía.

Una conexión rechazada utiliza el error:

```text
AUTHENTICATION_REQUIRED
```

No se debe enviar el token como parámetro público de la URL.

## 4. Salas internas

Después de autenticar una conexión, el servidor incorpora el socket a salas internas:

```text
business:<businessId>
membership:<membershipId>
business:<businessId>:role:<role>
```

Ejemplo:

```text
business:1
membership:2
business:1:role:WAITER
business:1:role:KITCHEN
```

El cliente no selecciona ni solicita estas salas. El servidor las determina a partir de la sesión autenticada.

Esto permite:

- Separar los eventos de cada negocio.
- Dirigir eventos a una membresía concreta en el futuro.
- Dirigir eventos únicamente a los roles autorizados.

## 5. Distribución por roles

| Evento                                    | ADMIN | WAITER | KITCHEN |
| ----------------------------------------- | ----: | -----: | ------: |
| `session:ready`                           |    Sí |     Sí |      Sí |
| `order:created`                           |    Sí |     Sí |      No |
| `order:updated`                           |    Sí |     Sí |      No |
| `order:items-added` con orden `OPEN`      |    Sí |     Sí |      No |
| `order:item-updated`                      |    Sí |     Sí |      No |
| `order:item-removed`                      |    Sí |     Sí |      No |
| `order:confirmed`                         |    Sí |     Sí |      Sí |
| `order:items-added` con orden `CONFIRMED` |    Sí |     Sí |      Sí |
| `order:item-cancelled`                    |    Sí |     Sí |      Sí |
| `kitchen-ticket:item-status-updated`      |    Sí |     Sí |      Sí |
| `order:status-updated`                    |    Sí |     Sí |      Sí |

Una conexión con varios roles no debe recibir duplicado el mismo evento cuando la emisión se realiza simultáneamente hacia varias salas.

## 6. Consideraciones generales de los payloads

- Todos los identificadores se transmiten como `string`.
- Las fechas se transmiten como texto ISO 8601 en UTC.
- Los valores monetarios continúan representándose como `string` para evitar pérdida de precisión.
- Los campos opcionales de la base de datos se representan con `null`.
- Los eventos pueden ser utilizados para actualizar la caché local o para invalidar y consultar nuevamente un endpoint REST.
- El frontend debe actualizar entidades por su identificador, no agregar elementos ciegamente, para evitar duplicados.

## 7. Evento `session:ready`

### Dirección

Servidor hacia cliente.

### Cuándo se emite

Inmediatamente después de autenticar la conexión y asignar sus salas.

### Payload

```json
{
  "userId": "2",
  "businessId": "1",
  "membershipId": "2",
  "roles": ["WAITER", "KITCHEN"],
  "connectedAt": "2026-09-23T14:00:00.000Z"
}
```

### Uso en el frontend

- Marcar la conexión como lista.
- Verificar el negocio y la membresía asociados.
- Registrar los roles efectivos de la conexión.
- Cargar o recargar el estado inicial mediante REST.

El listener debe registrarse antes de llamar a `socket.connect()`, porque el evento se emite inmediatamente.

## 8. Evento `session:ping`

### Dirección

Cliente hacia servidor con acknowledgement.

### Emisión

```ts
socket.emit("session:ping", (response) => {
  console.log(response.serverTime);
});
```

### Respuesta

```json
{
  "serverTime": "2026-09-23T14:00:10.000Z"
}
```

Sirve para comprobar que la conexión continúa activa y que el servidor puede responder.

## 9. Evento `order:created`

### Origen

```text
POST /api/orders
```

### Destinatarios

`ADMIN` y `WAITER` del mismo negocio.

### Payload

```json
{
  "businessId": "1",
  "orderId": "8",
  "restaurantTableId": null,
  "openedByMembershipId": "1",
  "serviceType": "TAKEAWAY",
  "status": "OPEN",
  "customerCount": 1,
  "notes": "Pedido para llevar",
  "createdAt": "2026-09-23T14:05:00.000Z"
}
```

### Acción recomendada

- Agregar o actualizar la orden en la lista de órdenes abiertas.
- Actualizar la disponibilidad visual de la mesa cuando `serviceType` sea `TABLE`.
- Cocina no debe mostrarla todavía porque no existe una comanda confirmada.

## 10. Evento `order:updated`

### Origen

```text
PATCH /api/orders/:orderId
```

### Destinatarios

`ADMIN` y `WAITER` del mismo negocio.

### Payload

```json
{
  "businessId": "1",
  "orderId": "8",
  "status": "OPEN",
  "serviceType": "TABLE",
  "restaurantTableId": "2",
  "customerCount": 3,
  "notes": "Cliente ubicado cerca de la ventana",
  "changedByMembershipId": "1",
  "updatedAt": "2026-09-23T14:06:00.000Z"
}
```

### Acción recomendada

- Actualizar modalidad, mesa, cantidad de clientes y notas.
- Si cambió la mesa, actualizar la disponibilidad visual de la mesa anterior y la nueva.

## 11. Evento `order:items-added`

### Origen

```text
POST /api/orders/:orderId/items
```

### Destinatarios

- Orden `OPEN`: `ADMIN` y `WAITER`.
- Orden `CONFIRMED`: `ADMIN`, `WAITER` y `KITCHEN`.

### Payload

```json
{
  "businessId": "1",
  "orderId": "8",
  "orderStatus": "CONFIRMED",
  "addedByMembershipId": "1",
  "orderItems": [
    {
      "id": "18",
      "productId": "6",
      "preparationAreaId": "1",
      "fulfillmentMode": "PREPARE_TO_ORDER",
      "productName": "Crepe de pollo",
      "quantity": 1,
      "notes": "Sin salsa",
      "createdAt": "2026-09-23T14:07:00.000Z"
    }
  ]
}
```

### Acción recomendada

- Incorporar los productos a la orden utilizando su `id`.
- Recalcular o consultar el subtotal de la orden.
- Si `orderStatus` es `CONFIRMED`, cocina debe invalidar y consultar nuevamente las comandas activas de las áreas correspondientes.
- Si es `OPEN`, cocina no recibe el evento.

## 12. Evento `order:item-updated`

### Origen

```text
PATCH /api/orders/:orderId/items/:orderItemId
```

### Destinatarios

`ADMIN` y `WAITER` del mismo negocio.

Solamente aplica a productos de órdenes `OPEN`.

### Payload

```json
{
  "businessId": "1",
  "orderId": "8",
  "orderItemId": "18",
  "productName": "Pan de chocolate",
  "quantity": 3,
  "unitPrice": "4500.00",
  "lineTotal": "13500.00",
  "notes": "Cantidad actualizada antes de confirmar",
  "updatedAt": "2026-09-23T14:08:00.000Z"
}
```

### Acción recomendada

- Reemplazar los datos del producto identificado por `orderItemId`.
- Actualizar el subtotal mostrado.

## 13. Evento `order:item-removed`

### Origen

```text
DELETE /api/orders/:orderId/items/:orderItemId
```

### Destinatarios

`ADMIN` y `WAITER` del mismo negocio.

Solamente aplica a productos de órdenes `OPEN`.

### Payload

```json
{
  "businessId": "1",
  "orderId": "8",
  "orderItemId": "18",
  "removedAt": "2026-09-23T14:09:00.000Z"
}
```

### Acción recomendada

- Retirar el artículo de la orden local.
- Actualizar el subtotal mostrado.

## 14. Evento `order:confirmed`

### Origen

```text
POST /api/orders/:orderId/confirm
```

### Destinatarios

`ADMIN`, `WAITER` y `KITCHEN` del mismo negocio.

### Payload

```json
{
  "businessId": "1",
  "orderId": "8",
  "status": "CONFIRMED",
  "confirmedAt": "2026-09-23T14:10:00.000Z",
  "kitchenTickets": [
    {
      "id": "5",
      "preparationAreaId": "1",
      "currentVersion": 1,
      "orderItemIds": ["19", "20"]
    }
  ]
}
```

### Acción recomendada

- Mover la orden de `OPEN` a `CONFIRMED`.
- Cocina debe consultar las comandas activas.
- Cada resumen indica qué comanda se creó para cada área de preparación.
- `READY_TO_SERVE` comienza en `READY`; `PREPARE_TO_ORDER` comienza en `PENDING`.

## 15. Evento `order:item-cancelled`

### Origen

```text
POST /api/orders/:orderId/items/:orderItemId/cancel
```

### Destinatarios

`ADMIN`, `WAITER` y `KITCHEN` del mismo negocio.

### Payload

```json
{
  "businessId": "1",
  "orderId": "8",
  "orderItemId": "19",
  "kitchenTicketId": "5",
  "kitchenTicketItemId": "12",
  "kitchenTicketVersion": 2,
  "preparationStatus": "CANCELLED",
  "orderStatus": "CONFIRMED",
  "cancellationReason": "El cliente ya no desea este producto",
  "cancelledByMembershipId": "1",
  "cancelledAt": "2026-09-23T14:11:00.000Z"
}
```

### Acción recomendada

- Marcar como cancelados el artículo de la orden y el artículo de la comanda.
- Mostrar el motivo de cancelación en cocina.
- Invalidar los totales de la orden.
- Actualizar la versión local de la comanda.
- Si `orderStatus` cambió, también se recibirá `order:status-updated`.

## 16. Evento `kitchen-ticket:item-status-updated`

### Origen

```text
PATCH /api/kitchen-tickets/:kitchenTicketId/items/:kitchenTicketItemId/status
```

### Destinatarios

`ADMIN`, `WAITER` y `KITCHEN` del mismo negocio.

### Payload

```json
{
  "businessId": "1",
  "orderId": "8",
  "kitchenTicketId": "5",
  "kitchenTicketItemId": "12",
  "preparationStatus": "READY",
  "orderDelivered": false,
  "updatedAt": "2026-09-23T14:12:00.000Z"
}
```

### Estados posibles

Para `PREPARE_TO_ORDER`:

```text
PENDING → IN_PREPARATION → READY → DELIVERED
```

Para `READY_TO_SERVE`:

```text
READY → DELIVERED
```

`CANCELLED` se produce mediante el endpoint de cancelación, no mediante el endpoint normal de avance de preparación.

### Acción recomendada

- Actualizar el artículo identificado por `kitchenTicketItemId`.
- Mover visualmente el artículo entre columnas o estados.
- Si `orderDelivered` es `true`, esperar también `order:status-updated` y actualizar la orden completa.

## 17. Evento `order:status-updated`

### Orígenes actuales

- Entrega del último producto pendiente.
- Cancelación que deja la orden sin productos activos.
- Cancelación después de que todos los productos activos restantes ya fueron entregados.
- Cierre de una orden entregada.

### Destinatarios

`ADMIN`, `WAITER` y `KITCHEN` del mismo negocio.

### Payload

```json
{
  "businessId": "1",
  "orderId": "8",
  "previousStatus": "CONFIRMED",
  "status": "DELIVERED",
  "changedByMembershipId": "2",
  "changedAt": "2026-09-23T14:13:00.000Z"
}
```

Otro ejemplo al cerrar la orden:

```json
{
  "businessId": "1",
  "orderId": "8",
  "previousStatus": "DELIVERED",
  "status": "CLOSED",
  "changedByMembershipId": "1",
  "changedAt": "2026-09-23T14:14:00.000Z"
}
```

### Acción recomendada

- Mover la orden entre listas según su nuevo estado.
- Liberar visualmente la mesa cuando el estado operativo correspondiente lo permita.
- Si el nuevo estado es `CLOSED` o `CANCELLED`, retirarla de las vistas activas.

## 18. Flujo recomendado en el frontend

### Después de iniciar sesión

1. Crear la instancia Socket.IO.
2. Registrar todos los listeners necesarios.
3. Enviar el access token mediante `auth.token`.
4. Conectar el socket.
5. Esperar `session:ready`.
6. Consultar mediante REST las órdenes, mesas o comandas necesarias.
7. Aplicar los eventos posteriores sobre la caché o invalidar consultas.

Ejemplo conceptual:

```ts
const socket = io(API_URL, {
  autoConnect: false,
  auth: {
    token: accessToken,
  },
});

socket.on("session:ready", () => {
  void reloadInitialData();
});

socket.on("order:created", (payload) => {
  updateOrInsertOrder(payload);
});

socket.on("order:confirmed", () => {
  void reloadOrders();
  void reloadKitchenTickets();
});

socket.on("kitchen-ticket:item-status-updated", (payload) => {
  updateKitchenTicketItem(payload);
});

socket.connect();
```

## 19. Reconexión y consistencia

Los eventos actuales no tienen almacenamiento ni reproducción automática. Si el cliente estuvo desconectado, no recibirá retroactivamente los eventos ocurridos durante ese periodo.

Al producirse una reconexión, el frontend debe:

1. Esperar nuevamente `session:ready`.
2. Consultar por REST el estado vigente.
3. Reemplazar o reconciliar su caché local.

El frontend no debe asumir que conserva el estado correcto únicamente porque Socket.IO se reconectó.

También debe:

- Tratar los eventos como idempotentes.
- Actualizar por identificadores.
- Ignorar duplicados ya aplicados.
- Preferir el estado obtenido por REST cuando exista una inconsistencia.

## 20. Cambio de token, contraseña o roles

El access token representa una sesión y unos roles concretos.

Después de:

- Cambiar la contraseña.
- Restablecer la contraseña.
- Cambiar los roles del empleado.
- Desactivar y reactivar una membresía.
- Iniciar una nueva sesión requerida por el backend.

El frontend debe desconectar el socket anterior, actualizar el token e iniciar una conexión nueva.

Ejemplo:

```ts
socket.disconnect();
socket.auth = {
  token: newAccessToken,
};
socket.connect();
```

Al cerrar sesión, el frontend debe desconectar explícitamente el socket.

## 21. Estrategia de actualización de pantallas

El frontend puede utilizar dos estrategias:

### Actualización local

Aplicar directamente el payload cuando contiene todos los campos requeridos.

Ejemplos:

- `order:item-updated`.
- `order:item-removed`.
- `kitchen-ticket:item-status-updated`.

### Invalidación y nueva consulta

Consultar REST cuando el evento representa una operación con varios efectos relacionados.

Ejemplos:

- `order:confirmed` debe recargar comandas.
- `order:items-added` sobre una orden confirmada debe recargar la comanda afectada.
- `order:item-cancelled` debe actualizar orden, subtotal y comanda.
- `order:status-updated` puede cambiar listas, mesa y disponibilidad.

En la primera versión del frontend se recomienda favorecer la invalidación y nueva consulta para reducir inconsistencias. Posteriormente pueden optimizarse los casos de actualización local.

## 22. Configuración de Postman

Las solicitudes Socket.IO se guardan en una colección separada de las solicitudes HTTP:

```text
Sazora API - Realtime
├── SOCKET Conexión administrador
└── SOCKET Conexión empleado
```

Conexión de administrador:

```text
Authorization: Bearer {{accessToken}}
```

Conexión de empleado:

```text
Authorization: Bearer {{employeeAccessToken}}
```

Configuración:

```text
Client version: v4
Handshake path: /socket.io
```

Los eventos deben registrarse y activar `Listen` antes de conectar.

## 23. Limitaciones actuales y trabajo futuro

- La implementación actual utiliza un único proceso de Socket.IO.
- Si el backend se ejecuta en varias instancias, será necesario un adaptador compartido, como Redis, y una estrategia compatible de balanceo.
- Los eventos no se almacenan ni tienen reproducción histórica.
- Cocina recibe eventos operativos de todas las áreas del negocio; una mejora futura puede crear salas por área de preparación.
- La separación entre dos negocios debe verificarse mediante pruebas cuando exista un segundo negocio de prueba.
- Las pruebas actuales en Postman son manuales; posteriormente deben añadirse pruebas automatizadas de conexión, autorización y aislamiento.
- La configuración productiva debe permitir WebSocket a través del proxy inverso y utilizar HTTPS/WSS.

## 24. Archivos principales

- `src/realtime/realtime.types.ts`: contratos TypeScript de eventos.
- `src/realtime/realtime.rooms.ts`: nombres de salas.
- `src/realtime/realtime.events.ts`: emisión y selección de destinatarios.
- `src/realtime/realtime.server.ts`: inicialización y conexiones.
- `src/realtime/middlewares/authenticate-realtime.middleware.ts`: autenticación del handshake.
- `src/server.ts`: integración entre HTTP y Socket.IO.

## 25. Resultado del módulo

El módulo permite actualmente:

- Autenticar conexiones en tiempo real.
- Aislar conexiones por negocio.
- Separar destinatarios por rol.
- Notificar el ciclo de una orden abierta.
- Notificar confirmación y creación de comandas.
- Notificar adiciones posteriores a una orden confirmada.
- Notificar cancelaciones.
- Notificar el avance de preparación y entrega.
- Notificar la entrega y cierre de la orden.
- Mantener sincronizadas las futuras pantallas de caja, meseros y cocina.
