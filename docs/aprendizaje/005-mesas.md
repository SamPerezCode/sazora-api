# Aprendizaje 005: mesas del restaurante

## Objetivo

Documentar el módulo administrativo de mesas que servirá como base para abrir
órdenes y asociarlas con la ubicación atendida por el mesero.

## Endpoint implementado

```http
POST /api/restaurant-tables
```

La ruta exige un JWT válido y el rol `ADMIN`.

## Datos de una mesa

- `code`: identificador operativo único dentro del negocio, por ejemplo `MESA-01`.
- `name`: nombre que verá el personal, por ejemplo `Mesa 1`.
- `capacity`: cantidad opcional de personas que puede recibir.
- `isActive`: permite retirar la mesa del servicio sin borrar su historial.

El código se normaliza a mayúsculas y MySQL protege su unicidad por negocio.

## Aislamiento multiempresa

El `businessId` procede del JWT y no del cuerpo de la petición. Tanto la
inserción como la recuperación combinan el negocio autenticado con los datos de
la mesa.

## Ocupación

No existe una columna `isOccupied`. La ocupación se calculará posteriormente a
partir de las órdenes activas asociadas con la mesa. Así se evita que una mesa
figure como ocupada sin tener una orden abierta, o como libre mientras todavía
existe una orden activa.

## Pruebas realizadas

- [x] Crear una mesa válida produce HTTP 201.
- [x] La mesa se crea activa y asociada al negocio autenticado.
- [x] Postman guarda el identificador en `restaurantTableId`.
- [x] Consultar todas las mesas del negocio produce HTTP 200.
- [x] Consultar una mesa por su identificador produce HTTP 200.
- [x] Editar parcialmente una mesa produce HTTP 200.
- [x] Desactivar una mesa produce HTTP 200.
- [x] Reactivar una mesa produce HTTP 200.
- [x] La mesa quedó activa para utilizarla en órdenes.

## Consultas administrativas

`GET /api/restaurant-tables` devuelve las mesas activas e inactivas del negocio
autenticado. `GET /api/restaurant-tables/:restaurantTableId` recupera una mesa
específica. Ambas consultas filtran por `business_id`.

## Edición y estado lógico

`PATCH /api/restaurant-tables/:restaurantTableId` modifica código, nombre o
capacidad y conserva los valores omitidos. `PATCH
/api/restaurant-tables/:restaurantTableId/status` desactiva o reactiva la mesa
sin eliminarla ni perder sus relaciones históricas.

## Estado del módulo

El flujo administrativo principal de mesas está completo.
