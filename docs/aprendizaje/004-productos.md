# Aprendizaje 004: productos

## Objetivo

Documentar el flujo administrativo que crea productos y los relaciona con una
categoría y un área de preparación del mismo negocio.

## Endpoint implementado

```http
POST /api/products
```

La ruta exige un JWT válido y el rol `ADMIN`.

## Flujo

```text
Postman
  → authenticate
  → authorizeRoles(ADMIN)
  → createProductController
  → createProductSchema
  → createProductService
  → productRepository
  → MySQL
  → HTTP 201
```

## Responsabilidad de cada componente

- `product.routes.ts` protege la ruta con autenticación y autorización.
- `product.controller.ts` recibe la petición y obtiene el negocio del JWT.
- `create-product.schema.ts` valida identificadores, SKU, nombre, descripción y precio.
- `create-product.service.ts` aplica las reglas de categoría y área activas.
- `product.repository.ts` inserta y recupera el registro mediante consultas parametrizadas.
- `product.types.ts` define la forma de los datos dentro de TypeScript.

## Aislamiento multiempresa

El cliente no puede enviar el `businessId`. El controlador utiliza el negocio
contenido en `request.auth`. Las búsquedas de la categoría y el área combinan
ese negocio con sus respectivos identificadores.

Las llaves foráneas compuestas de MySQL ofrecen una segunda protección para
impedir relaciones entre registros de negocios diferentes.

## Categoría y área de preparación

La categoría organiza el producto en el catálogo. El área de preparación
determina qué zona recibirá su comanda. El servicio rechaza categorías o áreas
inexistentes y también las que estén desactivadas.

## Dinero y SKU

`currentPrice` se recibe y devuelve como texto decimal. Así se evita la pérdida
de precisión de `number` al representar dinero.

El SKU es opcional, se normaliza a mayúsculas y debe ser único dentro del
negocio. MySQL detecta duplicados y el servicio los convierte en HTTP 409.

## Respuestas de error comprobadas

- `VALIDATION_ERROR`: datos o precio con formato inválido.
- `PRODUCT_SKU_CONFLICT`: el SKU ya está utilizado en el negocio.
- `CATEGORY_NOT_FOUND`: la categoría no existe en el negocio.
- `CATEGORY_INACTIVE`: la categoría está desactivada.
- `PREPARATION_AREA_NOT_FOUND`: el área no existe en el negocio.
- `PREPARATION_AREA_INACTIVE`: el área está desactivada.

## Pruebas realizadas

- [x] Crear un producto válido produce HTTP 201.
- [x] El producto se relaciona con su categoría y área de preparación.
- [x] Repetir el SKU produce HTTP 409.
- [x] Un precio con más de dos decimales produce HTTP 400.
- [x] Una categoría o área inexistente produce HTTP 404.
- [x] Una categoría o área desactivada produce HTTP 409.
- [x] La categoría y el área quedaron activas después de las pruebas.
- [x] Postman guardó el identificador en `productId`.
- [x] Consultar los productos del negocio produce HTTP 200.
- [x] La consulta incluye los nombres y estados de categoría y área.
- [x] La consulta calcula si el producto está disponible.
- [x] Editar parcialmente un producto produce HTTP 200.
- [x] Una actualización vacía produce HTTP 400.
- [x] Editar un producto inexistente produce HTTP 404.
- [x] Utilizar un SKU ya asignado produce HTTP 409.
- [x] Cambiar a una categoría o área inexistente produce HTTP 404.
- [x] Desactivar y reactivar un producto produce HTTP 200.
- [x] Un producto desactivado tiene `isAvailable` igual a falso.
- [x] Enviar un estado inválido produce HTTP 400.
- [x] Cambiar el estado de un producto inexistente produce HTTP 404.
- [x] Consultar un producto por su identificador produce HTTP 200.

## Consulta administrativa

`GET /api/products` devuelve los productos activos e inactivos del negocio
autenticado. La consulta relaciona `products`, `categories` y
`preparation_areas` mediante `INNER JOIN` y siempre filtra por `business_id`.

El campo `isAvailable` no se almacena en la base de datos. Se calcula al
consultar y solo es verdadero cuando el producto, su categoría y su área de
preparación están activos. Postman confirmó la respuesta y guardó `productId`.

## Edición administrativa

`PATCH /api/products/:productId` modifica únicamente los campos enviados. El
servicio recupera el producto actual y conserva los valores omitidos. Si se
envía una nueva categoría o área, comprueba que pertenezca al negocio y esté
activa antes de ejecutar el `UPDATE`.

El esquema rechaza cuerpos vacíos y valida nuevamente SKU, nombre, descripción
y precio. La cláusula `WHERE` combina `business_id` e `id` para impedir que un
administrador modifique productos de otro negocio.

## Estado lógico y consulta individual

`PATCH /api/products/:productId/status` desactiva o reactiva el producto sin
eliminarlo. Esto conserva sus relaciones y permitirá mantener el historial de
órdenes. La disponibilidad calculada cambia inmediatamente cuando el producto
se desactiva.

`GET /api/products/:productId` devuelve un producto específico junto con los
nombres y estados de su categoría y área de preparación, además de
`isAvailable`.

## Estado del módulo

El flujo administrativo principal de productos está completo.
