# Flujo transaccional de órdenes

## Implementación actual

La selección de mesa y la construcción inicial del carrito ocurren localmente en el frontend.

Mientras el carrito no tenga productos, el frontend no debe realizar ninguna petición de creación.

Cuando el usuario guarda o envía un carrito con productos, utiliza:

```http
POST /api/orders
```
