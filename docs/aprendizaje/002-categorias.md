# Aprendizaje 002: categorías

## Objetivo

Documentar el primer flujo administrativo del catálogo de Sazora: crear una
categoría dentro del negocio autenticado.

## Endpoint implementado

```http
POST /api/categories
```

La ruta requiere:

- Un JWT válido.
- Una sesión perteneciente a un negocio.
- El rol `ADMIN`.

## Archivos del flujo

| Archivo                      | Responsabilidad                                               |
| ---------------------------- | ------------------------------------------------------------- |
| `category.types.ts`          | Define los tipos de una categoría y de sus datos de creación. |
| `create-category.schema.ts`  | Valida y transforma el cuerpo recibido.                       |
| `category.repository.ts`     | Ejecuta el `INSERT` y recupera el registro creado.            |
| `create-category.service.ts` | Coordina la creación y traduce duplicados a HTTP 409.         |
| `category.controller.ts`     | Obtiene el negocio autenticado y construye la respuesta HTTP. |
| `category.routes.ts`         | Aplica autenticación, autorización y controller.              |
| `routes/index.ts`            | Registra el módulo bajo `/api/categories`.                    |

## Flujo completo

```text
Postman
  → POST /api/categories
  → authenticate
  → authorizeRoles(ADMIN)
  → createCategoryController
  → createCategorySchema
  → createCategoryService
  → categoryRepository
  → MySQL
  → respuesta HTTP 201
```

## Aislamiento multiempresa

El cliente no envía `businessId` en el cuerpo. El controller obtiene el negocio
desde `request.auth.businessId`, cuyo valor proviene del JWT verificado.

Esto evita que una persona intente crear una categoría dentro de otro negocio
enviando manualmente un identificador diferente.

## Validación

El cuerpo acepta:

- `name`: obligatorio, entre 1 y 100 caracteres después de eliminar espacios.
- `description`: opcional, con máximo 255 caracteres; un valor vacío se
  transforma en `null`.
- `displayOrder`: entero entre 0 y 65535; su valor predeterminado es 0.

El esquema es estricto, por lo que no acepta propiedades desconocidas.

## Persistencia

El repositorio ejecuta primero:

```sql
INSERT INTO categories (
  business_id,
  name,
  description,
  display_order
)
VALUES (?, ?, ?, ?);
```

Después utiliza el identificador generado para consultar y devolver la
categoría completa. La consulta combina `business_id` e `id` para mantener
explícito el aislamiento del negocio.

`is_active` se transforma de 0 o 1, utilizado por MySQL, a un valor booleano
de JavaScript.

## Categorías duplicadas

La base de datos posee una restricción única sobre `business_id` y `name`.
Dos negocios pueden usar el mismo nombre, pero un negocio no puede repetirlo.

El servicio convierte el error `ER_DUP_ENTRY` de MySQL en:

```http
409 Conflict
```

```json
{
  "status": "error",
  "code": "CATEGORY_NAME_CONFLICT",
  "message": "Ya existe una categoría con ese nombre"
}
```

## Autenticación y autorización

`authenticate` verifica que exista un Bearer Token válido y carga la identidad
en `request.auth`.

`authorizeRoles("ADMIN")` comprueba que la identidad autenticada tenga el rol
necesario. La diferencia entre respuestas es:

- HTTP 401: no existe una autenticación válida.
- HTTP 403: existe una autenticación válida, pero falta el rol requerido.

## Pruebas realizadas en Postman

- [x] Crear una categoría válida produce HTTP 201.
- [x] Crear nuevamente el mismo nombre produce HTTP 409.
- [x] Enviar un nombre vacío y un orden negativo produce HTTP 400.
- [x] Enviar la petición sin token produce HTTP 401.
- [x] Consultar las categorías del negocio produce HTTP 200.
- [x] Editar una categoría existente produce HTTP 200.
- [x] Enviar una actualización vacía produce HTTP 400.
- [x] Editar una categoría inexistente produce HTTP 404.
- [x] Desactivar una categoría produce HTTP 200.
- [x] Reactivar una categoría produce HTTP 200.
- [x] Enviar un estado que no es booleano produce HTTP 400.
- [x] Cambiar el estado de una categoría inexistente produce HTTP 404.
- [ ] Enviar la petición con un usuario sin rol `ADMIN` produce HTTP 403.

## Activación y desactivación

`PATCH /api/categories/:categoryId/status` modifica exclusivamente
`is_active`. La categoría permanece almacenada y continúa disponible para
consultas administrativas e información histórica.

El servicio devuelve el registro actual sin ejecutar un `UPDATE` cuando ya
tiene el estado solicitado. La prueba final dejó la categoría activa para
utilizarla posteriormente al crear productos.

## Edición de categorías

`PATCH /api/categories/:categoryId` permite modificar el nombre, la descripción
y el orden sin reemplazar obligatoriamente todos los campos.

El esquema exige al menos un campo y valida el identificador recibido en la
URL. El servicio recupera primero el registro actual, conserva los valores que
no fueron enviados y responde HTTP 404 si la categoría no pertenece al negocio
autenticado.

La consulta de actualización incluye `business_id` y `id`, por lo que un
administrador no puede modificar categorías de otro negocio.

## Consulta de categorías

`GET /api/categories` recupera las categorías del negocio identificado por el
JWT. La consulta no acepta un `businessId` enviado por el cliente.

El resultado incluye categorías activas e inactivas porque esta ruta pertenece
a la administración del catálogo. Los registros se ordenan por
`display_order`, nombre e identificador.

La prueba de Postman confirmó que la respuesta contiene un arreglo y que la
categoría `Panadería` pertenece al negocio autenticado.

La categoría `Panadería` quedó creada para MOKAI Panadería y Café.

## Decisiones técnicas

- El negocio se obtiene exclusivamente de la identidad autenticada.
- Las rutas administrativas requieren el rol `ADMIN`.
- Los nombres duplicados se protegen tanto en MySQL como en el servicio.
- Las categorías se desactivarán en lugar de eliminarse físicamente.
- El módulo conserva capas separadas para rutas, controllers, servicios,
  repositorios, esquemas y tipos.

## Pendientes del módulo

- Probar autorización con un usuario sin rol `ADMIN`.
