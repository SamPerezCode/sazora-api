# Aprendizaje 003: áreas de preparación

## Objetivo

Documentar el flujo que crea las zonas operativas encargadas de recibir y
preparar los productos incluidos en una orden.

## Diferencia entre categoría y área

Una categoría organiza los productos en el catálogo. Un área de preparación
determina qué zona recibirá la comanda de un producto.

Por ejemplo, un pedido puede contener productos de la categoría `Desayunos`,
pero enviar el jugo al área `Bebidas` y el pan al área `Panadería`.

## Endpoint implementado

```http
POST /api/preparation-areas
```

La ruta exige un JWT válido y el rol `ADMIN`.

## Flujo

```text
Postman
  → authenticate
  → authorizeRoles(ADMIN)
  → createPreparationAreaController
  → createPreparationAreaSchema
  → createPreparationAreaService
  → preparationAreaRepository
  → MySQL
  → HTTP 201
```

## Aislamiento multiempresa

El `businessId` se obtiene de `request.auth` y no del cuerpo enviado por el
cliente. El nombre del área es único dentro de cada negocio, pero diferentes
negocios pueden utilizar nombres iguales.

## Datos aceptados

- `name`: obligatorio, máximo 100 caracteres.
- `description`: opcional, máximo 255 caracteres.
- `displayOrder`: entero entre 0 y 65535, con valor predeterminado 0.

Las áreas nuevas se crean activas.

## Manejo de duplicados

MySQL protege la combinación `business_id` y `name`. El servicio transforma
`ER_DUP_ENTRY` en HTTP 409 con el código
`PREPARATION_AREA_NAME_CONFLICT`.

## Pruebas realizadas

- [x] Crear un área válida produce HTTP 201.
- [x] Repetir el mismo nombre produce HTTP 409.
- [x] Enviar un nombre vacío y un orden negativo produce HTTP 400.
- [x] Consultar las áreas del negocio produce HTTP 200.
- [x] Editar un área existente produce HTTP 200.
- [x] Enviar una actualización vacía produce HTTP 400.
- [x] Editar un área inexistente produce HTTP 404.
- [x] Desactivar un área produce HTTP 200.
- [x] Reactivar un área produce HTTP 200.
- [x] Enviar un estado que no es booleano produce HTTP 400.
- [x] Cambiar el estado de un área inexistente produce HTTP 404.
- [x] Consultar un área por su identificador produce HTTP 200.

## Activación y desactivación

`PATCH /api/preparation-areas/:preparationAreaId/status` cambia únicamente
`is_active`. El área permanece almacenada para conservar sus relaciones con
productos, comandas e historial.

Si el área ya tiene el estado solicitado, el servicio devuelve el registro sin
ejecutar una actualización innecesaria. La prueba final dejó `Horno y
panadería` activa para utilizarla al crear productos.

## Edición

`PATCH /api/preparation-areas/:preparationAreaId` permite modificar nombre,
descripción y orden. El esquema exige al menos un campo y el servicio conserva
los valores que no se enviaron.

La búsqueda y el `UPDATE` combinan `business_id` e `id`. De esta manera, un
administrador solo puede modificar áreas pertenecientes a su negocio.

La prueba cambió el área `Panadería` a `Horno y panadería` y la consulta
posterior confirmó los nuevos valores almacenados.

## Consulta administrativa

`GET /api/preparation-areas` devuelve las áreas activas e inactivas del negocio
autenticado. La consulta utiliza el `businessId` del JWT y ordena los registros
por orden de visualización, nombre e identificador.

Postman confirmó que la respuesta contiene el área `Panadería` y guardó su
identificador en `preparationAreaId`.

El identificador creado se guarda en la variable de Postman
`preparationAreaId` para utilizarlo en los siguientes endpoints.

`GET /api/preparation-areas/:preparationAreaId` recupera un área específica
del negocio autenticado y devuelve HTTP 404 cuando no existe en ese negocio.

## Estado del módulo

El flujo administrativo principal del área de preparación está completo y los
productos ya utilizan esta relación para determinar su zona de comanda.
