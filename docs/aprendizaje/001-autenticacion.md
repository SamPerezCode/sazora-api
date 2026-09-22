# Aprendizaje 001: autenticación

## Objetivo

Comprender el flujo de autenticación multiempresa de Sazora: cómo se validan
los datos recibidos, cómo se consulta la identidad en MySQL y cómo colaboran
las distintas capas sin mezclar responsabilidades.

## Archivos estudiados

- [x] Esquema de validación del login.
- [x] Repositorio de autenticación.
- [ ] Servicio de contraseñas.
- [ ] Servicio de tokens.
- [ ] Servicio de inicio de sesión.
- [ ] Controlador y rutas.
- [ ] Manejo central de errores.
- [ ] Script de creación del administrador inicial.

Los elementos pendientes se documentarán después de estudiar cada archivo. Una
casilla marcada significa que el componente fue revisado y comprendido, no
solamente que existe en el proyecto.

## Conceptos aprendidos

### Esquema de validación del login

El archivo `login.schema.ts` define el contrato de entrada del inicio de sesión.
La petición debe contener:

- `email`: correo electrónico de la persona.
- `password`: contraseña sin cifrar que se comprobará de forma segura.
- `businessSlug`: identificador legible del negocio al que desea ingresar.

Zod comprueba que los datos existan y tengan el formato esperado antes de que
lleguen a la lógica de autenticación.

El esquema no consulta MySQL, no compara la contraseña y no crea el JWT. Su
responsabilidad se limita a validar y transformar datos externos.

### Validar y transformar

Validar significa comprobar que un dato cumpla ciertas reglas. Por ejemplo:

- Que el correo tenga un formato válido.
- Que la contraseña tenga la longitud permitida.
- Que el slug solo contenga minúsculas, números y guiones.

Transformar significa normalizar el dato antes de utilizarlo:

- `trim()` elimina espacios al principio y al final.
- `toLowerCase()` convierte el correo y el slug a minúsculas.

Gracias a esta normalización, `USUARIO@CORREO.COM` puede procesarse como
`usuario@correo.com`.

### Límite de la contraseña

La contraseña debe tener una longitud mínima y no puede superar los 72 bytes.

bcrypt solo procesa de forma segura los primeros 72 bytes. Los bytes no siempre
equivalen a caracteres: una tilde, un emoji u otro carácter Unicode puede ocupar
más de un byte.

`Buffer.byteLength(password, utf8)` mide los bytes reales de la contraseña.

### Tipos generados con Zod

`z.infer` crea un tipo de TypeScript a partir del esquema:

```typescript
type LoginInput = z.infer<typeof loginSchema>;
```

Esto evita mantener por separado un esquema y una interfaz con los mismos
campos. Si cambia el esquema, también cambia el tipo inferido.

### Repositorio de autenticación

El archivo `auth.repository.ts` contiene las operaciones de MySQL necesarias
para la autenticación.

Sus responsabilidades actuales son:

- Buscar la identidad completa mediante correo y slug del negocio.
- Comprobar mediante la consulta que usuario, negocio, membresía y roles estén
  activos.
- Agrupar en un arreglo todos los roles de la membresía.
- Actualizar `last_login_at` después de un inicio de sesión correcto.

El repositorio no decide si la contraseña es correcta y tampoco genera tokens.
Esas responsabilidades pertenecen a los servicios.

### Identidad global y pertenencia a un negocio

`users` representa la identidad global de una persona.

`business_memberships` representa su pertenencia a un negocio determinado.

Esto permite que una persona utilice las mismas credenciales en varios negocios
y tenga roles diferentes en cada uno.

Por esta razón, el login no busca solamente por correo. También necesita
`businessSlug` para determinar en qué negocio intenta ingresar la persona.

### Uso de INNER JOIN

La consulta relaciona:

```text
users
  → business_memberships
  → businesses
  → business_membership_roles
  → roles
```

Se utiliza `INNER JOIN` porque todas las relaciones deben existir para formar
una identidad válida.

Aunque el usuario exista, la consulta no devuelve filas si:

- El usuario está desactivado.
- El negocio está desactivado.
- La membresía está desactivada.
- El usuario no pertenece al negocio solicitado.
- La membresía no tiene roles activos.

### Parámetros preparados

La consulta utiliza signos `?`:

```sql
WHERE u.email = ?
  AND b.slug = ?
```

Los valores se envían por separado:

```typescript
[email, businessSlug];
```

Esto evita concatenar directamente los datos recibidos dentro del SQL y ayuda a
prevenir inyecciones SQL.

### Una fila por cada rol

MySQL puede devolver varias filas para la misma identidad porque una membresía
puede tener varios roles:

```text
Samyr | MOKAI | ADMIN
Samyr | MOKAI | WAITER
```

El repositorio toma los códigos y los agrupa:

```typescript
roles: [...new Set(rows.map((row) => row.roleCode))];
```

`map()` extrae los códigos, `Set` elimina duplicados y el operador `...` vuelve
a convertir el resultado en un arreglo.

### Identificadores BIGINT

Los identificadores de MySQL utilizan `BIGINT UNSIGNED`.

Como JavaScript puede perder precisión con enteros muy grandes, la consulta los
convierte a texto:

```sql
CAST(u.id AS CHAR) AS userId
```

Por eso los identificadores de la autenticación y del JWT se manejan como
`string`.

### Resultado nulo y seguridad

`findLoginIdentity()` devuelve `null` cuando no encuentra la identidad completa.

El repositorio no informa si falló el correo, el negocio, la membresía o el rol.
Más adelante, el servicio convierte ese resultado en un mensaje genérico de
credenciales inválidas. Esto evita revelar qué cuentas o negocios existen.

### Último inicio de sesión

`updateLastLogin()` registra la fecha y hora del último acceso correcto:

```sql
UPDATE users
SET last_login_at = CURRENT_TIMESTAMP(3)
WHERE id = ?;
```

Debe ejecutarse después de comprobar la contraseña, no solamente después de
encontrar al usuario.

## Diferencia entre esquema y repositorio

```text
loginSchema
  → valida y transforma los datos de entrada.

auth.repository
  → consulta y modifica información en MySQL.
```

Cada componente tiene una responsabilidad diferente y no debe asumir el trabajo
del otro.

## Flujo de una petición de login

El orden real de ejecución es:

```text
Postman
  → ruta POST /api/auth/login
  → controlador
  → loginSchema.parse(request.body)
  → servicio de inicio de sesión
  → repositorio de autenticación
  → MySQL
  → servicio de contraseñas
  → servicio de tokens
  → controlador
  → respuesta HTTP
```

Paso a paso:

1. Postman envía el correo, la contraseña y el slug.
2. La ruta dirige la petición al controlador.
3. El controlador entrega `request.body` a `loginSchema.parse()`.
4. El esquema valida y normaliza los datos.
5. El servicio solicita la identidad al repositorio.
6. El repositorio consulta MySQL y agrupa los roles.
7. El servicio comprueba la contraseña.
8. Si la autenticación es válida, el servicio genera el JWT.
9. El controlador devuelve la respuesta HTTP.

El orden utilizado para estudiar los archivos puede ser diferente del orden de
ejecución. Primero estamos comprendiendo las piezas internas y después
revisaremos cómo el servicio y el controlador las coordinan.

## Comandos aprendidos

- `npm run dev`: inicia la API en modo de desarrollo.
- `npm run format`: aplica el formato configurado con Prettier.
- `npm run lint`: analiza problemas de estilo y calidad.
- `npm run typecheck`: verifica los tipos sin generar archivos compilados.
- `npm run build`: compila TypeScript.
- `npm audit`: revisa vulnerabilidades conocidas en las dependencias.

## Consultas SQL aprendidas

- `SELECT` consulta información almacenada.
- `INNER JOIN` relaciona tablas y exige que la relación exista.
- `WHERE` filtra los registros.
- `ORDER BY` ordena los resultados.
- `UPDATE` modifica registros existentes.
- `CAST(... AS CHAR)` convierte un valor a texto.
- `CURRENT_TIMESTAMP(3)` obtiene la fecha y hora con milisegundos.
- Los parámetros `?` permiten enviar valores sin concatenarlos en el SQL.

## Pruebas realizadas

- [x] Enviar un cuerpo vacío produce HTTP 400.
- [x] Iniciar sesión con credenciales válidas produce HTTP 200.
- [x] El inicio de sesión correcto genera un JWT.
- [x] Postman guarda automáticamente el JWT en `accessToken`.
- [ ] Enviar una contraseña incorrecta produce HTTP 401.
- [ ] Enviar un negocio incorrecto produce HTTP 401.
- [x] Acceder sin token a una ruta protegida produce HTTP 401.
- [x] Enviar un token inválido produce HTTP 401.
- [ ] Enviar un token vencido produce HTTP 401.
- [x] Acceder a una ruta protegida con un token válido produce HTTP 200.

## Errores y soluciones

### Verificación de una sesión protegida

Se creó `GET /api/auth/session` como primera ruta protegida. La petición
hereda el Bearer Token de la colección de Postman y envía el JWT almacenado en
`accessToken`.

El middleware `authenticate` obtiene la cabecera `Authorization`, comprueba el
esquema `Bearer`, verifica la firma y el vencimiento del token y guarda su
contenido validado en `request.auth`.

La respuesta HTTP 200 confirmó que el JWT generado durante el login puede
utilizarse para acceder a recursos protegidos.

La misma ruta respondió HTTP 401 cuando no recibió un token y cuando recibió
un token inválido. Esto confirmó que el middleware bloquea las peticiones antes
de ejecutar el controlador protegido.

### Datos obligatorios ausentes

Al enviar un objeto vacío, la API respondió con `VALIDATION_ERROR` y HTTP 400.

Esto ocurrió porque faltaban `email`, `password` y `businessSlug`. La respuesta
confirmó que el esquema y el manejo central de errores funcionaban.

### JSON mal formado

`express.json()` genera un error de sintaxis antes de que Zod reciba el cuerpo
cuando el JSON tiene comillas, comas o variables mal ubicadas. El manejador
central reconoce ahora `entity.parse.failed` y responde HTTP 400 con el código
`INVALID_JSON`, en lugar de clasificarlo como un error interno HTTP 500.

### Credenciales incorrectas

Al utilizar una contraseña incorrecta, la API respondió con
`INVALID_CREDENTIALS` y HTTP 401.

Esto confirmó que encontrar el usuario no es suficiente: la contraseña también
debe coincidir con el hash guardado.

### Diferencia entre crear y revocar un JWT

Cada login genera un JWT diferente debido a datos como la fecha de creación y
vencimiento.

Crear un token nuevo no invalida automáticamente los anteriores. Un token
permanece válido hasta vencer, cambiar el secreto de firma o implementar un
mecanismo de revocación.

## Decisiones técnicas

- Utilizar Zod para validar datos externos.
- Normalizar el correo y el slug.
- Comprobar el límite de 72 bytes de bcrypt.
- Generar el tipo de TypeScript mediante `z.infer`.
- Separar el acceso a MySQL en un repositorio.
- Buscar la identidad mediante correo y negocio.
- Exigir usuario, negocio, membresía y roles activos.
- Utilizar parámetros preparados en las consultas.
- Manejar los identificadores `BIGINT` como texto.
- Permitir varios roles por membresía.
- No revelar qué parte de las credenciales fue incorrecta.
- Actualizar `last_login_at` únicamente después de autenticar correctamente.

## Pendientes de estudio

- Comprender cómo bcrypt crea y compara hashes.
- Comprender la firma y verificación de JWT.
- Estudiar cómo el servicio coordina el repositorio, bcrypt y JWT.
- Estudiar cómo el controlador recibe y responde peticiones HTTP.
- Estudiar el manejo centralizado de errores.
- Estudiar la transacción que crea el negocio y administrador inicial.
- Implementar y probar una primera ruta protegida.

## Explicación personal

El esquema de login funciona como una puerta de entrada: evita que datos
incompletos o con formato incorrecto alcancen la lógica de negocio.

El repositorio funciona como la capa especializada en MySQL: busca la identidad
completa del usuario dentro de un negocio y actualiza información relacionada
con su acceso.

Separar estas responsabilidades hace que el código sea más fácil de entender,
probar y modificar.

## Cambio autenticado de contraseña

```http
PATCH /api/auth/password
```

El endpoint permite que cualquier usuario autenticado cambie su propia
contraseña. No recibe un identificador de empleado: la identidad se obtiene
del JWT. Por tanto, la contraseña modificada siempre corresponde al propietario
del token enviado.

El cuerpo exige la contraseña actual, la nueva contraseña y su confirmación.
El servicio comprueba el hash actual, impide reutilizar la misma contraseña,
genera un hash nuevo con bcrypt y actualiza la credencial mediante una
comparación optimista para evitar sobrescribir un cambio concurrente.

## Versión de autenticación

La migración `025_add_user_auth_version.sql` agregó `users.auth_version`. Esta
versión se incluye en cada JWT y se contrasta con MySQL en todas las peticiones
protegidas.

Al cambiar una contraseña se incrementa `auth_version`. Como consecuencia,
todos los tokens emitidos con la versión anterior dejan de ser válidos
inmediatamente y el usuario debe iniciar sesión de nuevo. La invalidación se
aplica a todas sus pertenencias porque la contraseña pertenece a la identidad
global, no a un negocio específico.

## Tokens separados en Postman

Postman mantiene `accessToken` para el administrador y `employeeAccessToken`
para el empleado. Los requests de login utilizan `No Auth` y cada script guarda
la respuesta solamente en su variable correspondiente. Los requests personales
usan explícitamente el token del usuario cuya cuenta se desea probar.

## Pruebas del cambio de contraseña

- [x] Administrador y empleado pueden cambiar su propia contraseña.
- [x] La contraseña actual incorrecta es rechazada.
- [x] La nueva contraseña debe ser distinta y estar confirmada.
- [x] El token anterior deja de funcionar después del cambio.
- [x] La contraseña anterior deja de permitir el inicio de sesión.
- [x] La contraseña nueva permite iniciar sesión y obtener un token vigente.
