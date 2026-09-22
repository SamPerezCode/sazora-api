# Aprendizaje 009: empleados

## Objetivo

Documentar la administración del personal perteneciente a un negocio, sus
credenciales y sus roles operativos sin mezclar esta función con la
administración global de Sazora.

## Endpoint de creación

```http
POST /api/employees
```

La ruta exige un JWT del negocio y el rol `ADMIN`. El `businessId` se obtiene
del token; el cliente no puede elegir libremente a qué negocio vincular la
cuenta.

## Flujo transaccional

1. Zod valida nombre, correo, contraseña, confirmación y roles.
2. El servicio genera el hash con bcrypt.
3. El repositorio comprueba que los roles solicitados existan y estén activos.
4. Crea la identidad global en `users`.
5. Crea su relación con el negocio en `business_memberships`.
6. Inserta uno o varios registros en `business_membership_roles`.
7. Recupera y devuelve el empleado sin exponer credenciales.

Las inserciones ocurren dentro de una sola transacción. Si falla cualquier
paso, `ROLLBACK` evita dejar usuarios sin pertenencia o pertenencias sin roles.

## Roles empresariales

El primer flujo permite asignar `WAITER`, `KITCHEN` o ambos. No permite crear
otro `ADMIN`, porque elevar privilegios administrativos requerirá controles
adicionales. Los permisos siempre se evalúan dentro del negocio activo.

## Identidad global y correo existente

`users.email` es globalmente único. El endpoint actual crea únicamente
identidades nuevas. Si el correo ya existe responde
`EMPLOYEE_EMAIL_CONFLICT` y no cambia la contraseña ni vincula la identidad de
manera automática.

La vinculación futura de una persona existente con otro negocio utilizará una
invitación que esa persona deberá aceptar. Esta regla protege las cuentas de
ser agregadas arbitrariamente por administradores de otros negocios.

## Contraseñas

La contraseña debe contener al menos 12 caracteres y no superar 72 bytes. Se
recibe también `passwordConfirmation`, pero ninguno de los dos valores llega al
repositorio. El servicio entrega únicamente `passwordHash`, generado mediante
bcrypt, y la respuesta nunca incluye contraseña ni hash.

## Pruebas realizadas

- [x] Crear un empleado con `WAITER` y `KITCHEN` devuelve HTTP 201.
- [x] Se crean usuario, pertenencia y asignaciones de rol.
- [x] La respuesta no expone contraseña ni hash.
- [x] El empleado inicia sesión usando el `businessSlug` de MOKAI.
- [x] El JWT del empleado contiene sus dos roles.
- [x] Repetir el correo devuelve HTTP 409.
- [x] Un correo existente no se vincula automáticamente.

## Consulta del personal

`GET /api/employees` devuelve todas las pertenencias del negocio autenticado,
incluido su administrador. Agrupa las filas producidas por los roles para
entregar una sola persona con un arreglo `roles`.

La respuesta diferencia `userId`, que identifica globalmente a la persona, de
`membershipId`, que identifica su relación con el negocio actual. También
expone por separado el estado global de la identidad y el estado de la
pertenencia, además de `lastLoginAt`.

La consulta filtra siempre por el `businessId` del JWT y nunca selecciona
`password_hash`.

## Pruebas de consulta

- [x] Un administrador obtiene HTTP 200 y una lista.
- [x] La lista contiene al administrador y al empleado creado.
- [x] Los roles múltiples se agrupan en una sola persona.
- [x] La respuesta no contiene contraseña ni hash.
- [x] El token con `WAITER` y `KITCHEN` recibe HTTP 403.

## Consulta individual

`GET /api/employees/:employeeMembershipId` consulta una pertenencia concreta.
La ruta utiliza `membershipId` porque administra la relación de la persona con
el negocio, no su identidad global. El repositorio combina ese identificador
con el `businessId` del JWT para impedir consultas entre establecimientos.

## Pruebas de consulta individual

- [x] Consultar una pertenencia del negocio devuelve HTTP 200.
- [x] La respuesta incluye sus roles activos y último inicio de sesión.
- [x] La respuesta no expone credenciales.
- [x] Un identificador inexistente devuelve HTTP 404.

## Activación y desactivación de la pertenencia

```http
PATCH /api/employees/:employeeMembershipId/status
```

Este endpoint modifica `business_memberships.is_active`. No elimina al usuario
ni cambia `users.is_active`, porque la misma identidad global podría pertenecer
a otros negocios. La operación exige el rol `ADMIN` y combina el identificador
recibido con el `businessId` autenticado para conservar el aislamiento entre
negocios.

El cuerpo contiene exclusivamente un booleano:

```json
{
  "isActive": false
}
```

El administrador autenticado no puede desactivar su propia pertenencia. Esta
regla evita que el negocio quede accidentalmente sin acceso administrativo por
medio de este endpoint.

## Validación vigente de la sesión

La firma y expiración del JWT no son suficientes para autorizar una petición.
El middleware de autenticación comprueba además en MySQL que el usuario, el
negocio, la pertenencia y sus roles continúen activos. Los roles efectivos se
recuperan de la base de datos en lugar de confiar en la copia incluida en un
token antiguo.

Por esta razón, al desactivar una pertenencia su token existente deja de tener
acceso inmediatamente. Si posteriormente se reactiva, la identidad puede
volver a iniciar sesión normalmente.

## Pruebas del cambio de estado

- [x] Desactivar una pertenencia devuelve HTTP 200 y
      `membershipIsActive: false`.
- [x] Un token perteneciente a una membresía desactivada devuelve HTTP 401.
- [x] Reactivar la pertenencia devuelve HTTP 200 y
      `membershipIsActive: true`.
- [x] Un administrador no puede cambiar el estado de su propia pertenencia.
- [x] Una pertenencia inexistente o de otro negocio devuelve HTTP 404.

## Siguiente parte

Implementar el flujo seguro de recuperación de contraseña. El administrador
podrá iniciar o solicitar una recuperación, pero no conocer ni elegir la
contraseña definitiva del empleado.

## Reemplazo de roles operativos

```http
PUT /api/employees/:employeeMembershipId/roles
```

La operación reemplaza la asignación completa de roles del empleado. Actualmente
solo acepta `WAITER`, `KITCHEN` o ambos y exige al menos uno. Se utiliza `PUT`
porque el arreglo enviado representa el estado final deseado, no una adición
parcial a los roles existentes.

El repositorio bloquea la pertenencia durante la transacción, valida que todos
los roles solicitados existan y estén activos, desactiva las asignaciones
anteriores y activa las nuevas. Las asignaciones se conservan físicamente para
poder reactivarlas sin crear duplicados.

Este endpoint no permite modificar la propia pertenencia del administrador ni
una pertenencia que tenga el rol `ADMIN`. Así se evita retirar accidentalmente
el acceso administrativo mediante un flujo destinado al personal operativo.

Como cada petición autenticada recupera los roles vigentes desde MySQL, retirar
un rol cambia inmediatamente los permisos del empleado aunque su JWT todavía no
haya expirado.

## Verificaciones del reemplazo de roles

- [x] ESLint no reporta errores.
- [x] TypeScript valida los tipos sin emitir archivos.
- [x] El proyecto compila correctamente.

## Edición de los datos del empleado

```http
PATCH /api/employees/:employeeMembershipId
```

El administrador puede actualizar `fullName`, `email` o ambos. El esquema exige
al menos un campo, normaliza el correo y conserva la restricción global de
correo único. La contraseña no forma parte de este endpoint.

Como el nombre y el correo pertenecen a la identidad global en `users`, esta
operación solo se permite cuando la persona tiene una única pertenencia. Si la
identidad participa en varios negocios, deberá modificar sus datos mediante el
futuro flujo de cuenta personal para evitar que un administrador altere su
identidad en los demás establecimientos.

Las cuentas con rol `ADMIN` tampoco se editan mediante el módulo de empleados.
Sus datos personales se administrarán desde su propia cuenta autenticada.

## Verificaciones de edición

- [x] ESLint no reporta errores.
- [x] TypeScript valida los tipos sin emitir archivos.
- [x] El proyecto compila correctamente.
