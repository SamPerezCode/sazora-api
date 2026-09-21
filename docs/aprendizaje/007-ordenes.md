# Aprendizaje 007: órdenes

## Objetivo

Documentar el inicio del flujo operativo de órdenes, sus modalidades de
servicio y las garantías necesarias para mantener consistentes la orden, la
mesa y el historial de estados.

## Endpoint implementado

```http
POST /api/orders
```

La ruta requiere autenticación y permite los roles `ADMIN` y `WAITER`.

## Modalidades de servicio

- `TABLE`: consumo en una mesa física.
- `TAKEAWAY`: pedido realizado para llevar.
- `DELIVERY`: pedido para entrega a domicilio.

Solamente `TABLE` requiere `restaurantTableId`. Las otras modalidades deben
guardarlo como `NULL`, por lo que ventanilla y domicilios pueden acumular varias
órdenes activas sin inventar mesas ficticias.

La modalidad describe cómo se entrega el pedido, no dónde se originó. Canales
futuros como POS, web o integraciones externas se modelarán por separado.

## Flujo de creación

1. El controlador obtiene el negocio y la membresía desde el JWT.
2. Zod valida el cuerpo y aplica las reglas de la modalidad elegida.
3. El repositorio inicia una transacción.
4. Para `TABLE`, bloquea la mesa, comprueba que exista y esté activa, y revisa
   que no tenga otra orden activa.
5. Inserta la orden con estado inicial `OPEN`.
6. Registra el cambio inicial en `order_status_history`.
7. Confirma la transacción y devuelve la orden creada.

Si algo falla, la transacción ejecuta `ROLLBACK`. De esta forma no puede quedar
una orden sin su primer registro de historial.

## Concurrencia de mesas

La consulta de una mesa utiliza `FOR UPDATE`. Mientras una transacción decide si
puede abrir la orden, otra petición no puede tomar simultáneamente la misma mesa
y superar la validación. Los estados considerados activos son `OPEN`,
`CONFIRMED` y `DELIVERED`.

Esta restricción solo corresponde a mesas físicas. `TAKEAWAY` y `DELIVERY`
permiten varias órdenes activas porque representan clientes diferentes.

## Aislamiento multiempresa y seguridad

El cliente no envía `businessId` ni `openedByMembershipId`. Ambos se obtienen de
la identidad autenticada. Las consultas incluyen el negocio para impedir que
una persona consulte o utilice recursos de otro establecimiento.

## Migración de modalidades

La migración `023_expand_order_service_types.sql` sustituyó la modalidad antigua
`COUNTER` por `TAKEAWAY` y agregó `DELIVERY`. Dos restricciones `CHECK`
garantizan tanto los valores permitidos como la presencia o ausencia de una
mesa según la modalidad.

MySQL Workbench inicialmente bloqueó el `UPDATE` con el error 1175 por el modo
de actualizaciones seguras. Se resolvió agregando `id > 0` al filtro, utilizando
una columna clave, sin desactivar globalmente la protección.

## Pruebas

- [x] El proyecto supera formato, lint, comprobación de tipos y compilación.
- [x] La migración 023 se aplicó correctamente.
- [ ] Crear una orden `TABLE` devuelve HTTP 201.
- [ ] Una segunda orden activa para la misma mesa devuelve HTTP 409.
- [ ] Crear varias órdenes `TAKEAWAY` sin mesa devuelve HTTP 201.
- [ ] Crear varias órdenes `DELIVERY` sin mesa devuelve HTTP 201.
- [ ] Enviar una mesa con `TAKEAWAY` o `DELIVERY` devuelve HTTP 400.

- [x] Agregar varias líneas a una orden abierta devuelve HTTP 201.
- [x] Las líneas copian nombre, precio y área desde el catálogo.
- [x] Un arreglo de productos vacío devuelve HTTP 400.

## Productos de una orden

`POST /api/orders/:orderId/items` recibe un arreglo de entre 1 y 50 líneas. Una
sola petición puede contener productos diferentes o repetir un producto con
observaciones distintas. Las notas de cada línea son opcionales y no sustituyen
las observaciones generales guardadas en la orden.

El cliente solamente envía producto, cantidad y observaciones. Dentro de una
transacción, el backend bloquea la orden, exige que continúe `OPEN`, comprueba
que producto, categoría y área estén activos, y copia el nombre, precio y ruta
de preparación desde MySQL. También copia `fulfillmentMode`, de modo que una
orden conserva el comportamiento operativo que tenía el producto cuando fue
agregado, aunque el catálogo cambie posteriormente. Si una línea falla, ninguna
línea del lote debe persistirse.

## Consulta de órdenes

`GET /api/orders` devuelve resúmenes paginados y permite filtrar por estado y
modalidad. Cada resumen incluye mesa, cantidad de líneas activas y subtotal.
`GET /api/orders/:orderId` devuelve la cabecera, todas las líneas históricas y
los totales calculados por MySQL.

## Edición del borrador

Mientras una orden continúa `OPEN`, `PATCH
/api/orders/:orderId/items/:orderItemId` permite cambiar cantidad u
observaciones. `DELETE /api/orders/:orderId/items/:orderItemId` retira
físicamente una línea que cocina todavía no ha recibido.

Ambas operaciones bloquean primero la orden. Así no pueden ejecutarse al mismo
tiempo que una confirmación. Una vez confirmada, una línea se conservará y sus
cambios se manejarán mediante cancelación histórica, no mediante eliminación.

## Pruebas adicionales

- [x] Consultar el detalle devuelve líneas, totales y subtotal correcto.
- [x] Consultar órdenes devuelve resultados paginados y filtrables.
- [x] Retirar una línea abierta devuelve HTTP 204 y ajusta el subtotal.
- [x] Editar cantidad y notas devuelve HTTP 200 y recalcula `lineTotal`.

## Siguiente parte del flujo

Editar los datos generales de una orden abierta y posteriormente confirmar su
contenido para generar comandas agrupadas por área de preparación.

## Decisión sobre impresión

Confirmar una orden no realizará una operación de red o USB dentro de la
transacción. El backend generará posteriormente trabajos persistentes y un
agente local del establecimiento los enviará a una impresora compatible con
ESC/POS. Así, una falla de papel, energía o conexión no deshace la orden y el
trabajo puede reintentarse con trazabilidad.

## Confirmación y generación de comandas

`POST /api/orders/:orderId/confirm` bloquea la orden, exige que continúe abierta
y que contenga productos, agrupa sus líneas activas por área de preparación y
crea una comanda de versión 1 para cada grupo. Cada línea recibe su primer
evento en `kitchen_item_status_history`, pero su estado inicial depende del modo
operativo copiado desde el catálogo.

- `PREPARE_TO_ORDER` comienza en `PENDING` y sigue
  `PENDING → IN_PREPARATION → READY → DELIVERED`.
- `READY_TO_SERVE` comienza directamente en `READY` y solamente sigue
  `READY → DELIVERED`.

Un producto listo continúa apareciendo en la comanda de su área para que el
sistema controle que fue despachado. Omitirlo impediría saber si una gaseosa o
un producto de vitrina realmente se entregó.

La misma transacción actualiza la orden a `CONFIRMED`, registra la transición
`OPEN → CONFIRMED` y crea todas las comandas. Si cualquier inserción falla, se
revierte el conjunto completo.

Las consultas en MySQL confirmaron que cada línea activa aparece exactamente una
vez en su área y que los historiales de orden y preparación fueron creados.

## Pruebas de confirmación

- [x] Confirmar una orden con productos devuelve HTTP 200.
- [x] La orden cambia de `OPEN` a `CONFIRMED`.
- [x] Se crea una comanda por cada área involucrada.
- [x] Un producto `PREPARE_TO_ORDER` comienza en `PENDING`.
- [x] Un producto `READY_TO_SERVE` comienza directamente en `READY`.
- [x] Un producto listo puede pasar directamente de `READY` a `DELIVERED`.
- [x] Un producto preparado exige la secuencia completa de preparación.
- [x] La orden cambia automáticamente a `DELIVERED` cuando no quedan líneas
      activas sin entregar.
- [x] Se registran los historiales iniciales de orden y cocina.

## Pedido mixto comprobado

Se creó una orden `TAKEAWAY` con un crepe `PREPARE_TO_ORDER` y una gaseosa
`READY_TO_SERVE`. Al confirmar, el crepe comenzó en `PENDING` y la gaseosa en
`READY`. La gaseosa se entregó directamente; el crepe recorrió los tres cambios
operativos. Cuando ambos quedaron entregados, la orden cambió de `CONFIRMED` a
`DELIVERED` y registró `deliveredAt`.

## Cancelación posterior a la confirmación

`POST /api/orders/:orderId/items/:orderItemId/cancel` cancela una línea que ya
fue enviada a su área. La operación exige una orden `CONFIRMED`, un motivo y
una línea que todavía no esté entregada ni cancelada.

La cancelación no ejecuta `DELETE`. En una sola transacción:

1. Marca `order_items.status` como `CANCELLED` y conserva responsable, motivo y
   fecha.
2. Registra un evento `CANCELLED` en `order_item_changes`.
3. Cambia el elemento de la comanda a `CANCELLED`.
4. Registra la transición y el motivo en `kitchen_item_status_history`.
5. Incrementa `kitchen_tickets.current_version`.
6. Recalcula el estado de la orden y excluye la línea del subtotal activo.

Si no queda ninguna línea activa, la orden completa pasa a `CANCELLED`. Si
quedan líneas activas sin finalizar, continúa `CONFIRMED`. Si quedan líneas
activas pero todas ya fueron entregadas, pasa a `DELIVERED`.

## Pruebas de cancelación

- [x] Cancelar una línea pendiente devuelve HTTP 200.
- [x] La línea permanece en la orden con estado `CANCELLED`.
- [x] El elemento de comanda cambia a `CANCELLED`.
- [x] El motivo y la membresía responsable quedan registrados.
- [x] La versión de la comanda aumenta.
- [x] El subtotal excluye el producto cancelado.
- [x] La orden continúa confirmada cuando conserva productos pendientes.

## Adiciones posteriores a la confirmación

`POST /api/orders/:orderId/items` se utiliza tanto durante el borrador `OPEN`
como después de confirmar. En una orden abierta solamente crea las líneas. En
una orden `CONFIRMED`, cada adición también:

1. Registra un evento `ADDED` en `order_item_changes`.
2. Localiza o crea la comanda de su área.
3. Incrementa una sola vez la versión de cada comanda afectada.
4. Crea el elemento operativo con su primer evento histórico.
5. Conserva la orden en estado `CONFIRMED`.

El estado inicial sigue dependiendo de `fulfillmentMode`: una adición
`PREPARE_TO_ORDER` comienza en `PENDING` y una adición `READY_TO_SERVE`
comienza directamente en `READY`. Las órdenes `DELIVERED`, `CLOSED` o
`CANCELLED` no admiten nuevas líneas.

## Pruebas de adiciones confirmadas

- [x] Agregar un producto a una orden confirmada devuelve HTTP 201.
- [x] La nueva línea aparece en `order_items`.
- [x] Se registra el evento histórico `ADDED`.
- [x] La versión de la comanda aumenta.
- [x] Una gaseosa `READY_TO_SERVE` aparece directamente en `READY`.
- [x] La orden permanece `CONFIRMED` y su subtotal aumenta.

## Cierre definitivo

`POST /api/orders/:orderId/close` finaliza una orden que ya se encuentra en
`DELIVERED`. La operación bloquea la orden, exige la transición válida,
actualiza el estado a `CLOSED`, registra `closedAt` y crea el evento
`DELIVERED → CLOSED` en `order_status_history` dentro de la misma transacción.

Una orden cerrada no admite nuevas líneas ni modificaciones. En órdenes
`TABLE`, dejar de estar en un estado activo libera la mesa para una nueva
atención. El cierre actual representa el final operativo; la comprobación de
pagos se añadirá cuando exista el módulo de caja.

## Pruebas de cierre

- [x] Cerrar una orden entregada devuelve HTTP 200.
- [x] La orden cambia de `DELIVERED` a `CLOSED`.
- [x] `closedAt` conserva la fecha del cierre.
- [x] El historial registra `DELIVERED → CLOSED`.
- [x] Una orden cerrada rechaza nuevas líneas.
