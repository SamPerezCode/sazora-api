# Sazora API

Backend de Sazora, una plataforma de gestión para restaurantes, cafeterías,
panaderías y otros negocios gastronómicos.

El primer MVP cubrirá el flujo operativo entre meseros y cocina: apertura de
órdenes por mesa, registro de productos, generación de comandas, preparación,
adiciones, cancelaciones y cierre de la orden con trazabilidad histórica.

> Este repositorio contiene solamente el backend. El frontend futuro vivirá en
> un proyecto separado llamado `sazora-web`.

## Tecnologías previstas

- Node.js y TypeScript.
- Express y API REST.
- MySQL 8 con `mysql2/promise`.
- Zod para validación.
- JWT y bcrypt para autenticación.
- ESLint y Prettier.
- Socket.IO en una etapa posterior.

## Estado actual

**Bloque actual:** diseño conceptual de la base de datos del MVP.

**Último avance verificado:** arranque correcto con MySQL disponible y fallo
controlado ante credenciales inválidas, sin iniciar Express.

## Checklist del proyecto

Una tarea se marca como terminada solo después de implementarla y comprobar
que funciona.

### Configuración

- [x] Confirmar la carpeta independiente `sazora-api`.
- [x] Inicializar el proyecto con Node.js y npm.
- [x] Inicializar el repositorio Git.
- [x] Configurar TypeScript.
- [ ] Crear la estructura inicial de directorios.
- [x] Configurar variables de entorno.
- [x] Crear `.gitignore` y proteger información sensible.
- [x] Configurar ESLint.
- [x] Configurar Prettier.
- [x] Crear scripts de desarrollo, compilación y ejecución.

### API y servidor

- [x] Instalar y configurar Express.
- [x] Separar `app.ts` y `server.ts`.
- [x] Crear `GET /api/health`.
- [x] Configurar rutas.
- [x] Crear middleware para rutas no encontradas.
- [x] Crear manejo centralizado de errores.
- [ ] Definir el formato básico de respuestas HTTP.

### Base de datos

- [ ] Diseñar el modelo conceptual del MVP.
- [ ] Analizar entidades y relaciones.
- [x] Elegir diseño conceptual previo con construcción progresiva por módulos.
- [x] Elegir migraciones SQL pequeñas y numeradas con seeds separados.
- [ ] Crear la estructura para migraciones y seeds.
- [x] Crear `sazora_db` en MySQL.
- [x] Crear un usuario técnico con permisos limitados sobre `sazora_db`.
- [x] Comprobar el acceso del usuario técnico desde MySQL Workbench.
- [x] Configurar las variables de conexión.
- [x] Configurar el pool con `mysql2/promise`.
- [x] Comprobar la conexión desde el backend.
- [x] Comprobar el fallo controlado ante credenciales de MySQL inválidas.
- [x] Crear una consulta mínima de verificación.
- [ ] Crear progresivamente tablas, llaves y restricciones.
- [ ] Agregar índices justificados por las consultas.
- [ ] Agregar datos iniciales mediante seeds controlados.
- [ ] Implementar transacciones y rollback.
- [ ] Verificar las reglas de historial y trazabilidad.

### Módulos del MVP

- [ ] Roles.
- [ ] Usuarios.
- [ ] Autenticación.
- [ ] Autorización.
- [ ] Categorías.
- [ ] Productos.
- [ ] Mesas.
- [ ] Órdenes.
- [ ] Detalles de órdenes.
- [ ] Comandas.
- [ ] Adiciones.
- [ ] Cancelaciones.
- [ ] Historial de estados.
- [ ] Registro de reimpresiones.

### Validación y seguridad

- [ ] Validar entradas con Zod.
- [ ] Almacenar contraseñas con hash de bcrypt.
- [ ] Implementar autenticación con JWT.
- [ ] Proteger variables sensibles.
- [ ] Validar roles y permisos.
- [ ] Validar transiciones de estado.
- [ ] Evitar confiar en precios o totales enviados por el frontend.

### Verificación

- [ ] Preparar pruebas manuales con Postman.
- [ ] Ejecutar consultas de comprobación en MySQL.
- [ ] Verificar casos exitosos.
- [ ] Verificar casos de error.
- [ ] Verificar transacciones y rollback.
- [ ] Verificar permisos por rol.

### Tiempo real

- [ ] Estudiar los fundamentos de Socket.IO.
- [ ] Conectar cliente y servidor.
- [ ] Crear eventos de órdenes.
- [ ] Crear eventos de cocina.
- [ ] Gestionar la reconexión.
- [ ] Recuperar el estado mediante la API REST.

### Seguimiento del aprendizaje

- [ ] Mantener un registro de conceptos aprendidos.
- [ ] Mantener un registro de comandos aprendidos.
- [ ] Mantener un registro de consultas SQL aprendidas.
- [ ] Documentar errores relevantes y su solución.
- [ ] Documentar decisiones técnicas.
- [ ] Documentar pendientes de etapas posteriores.

## Decisiones técnicas

### DT-001: arquitectura inicial

Sazora se construirá como un monolito modular. Los módulos estarán separados
por responsabilidad de negocio, pero se desplegarán como una sola aplicación.

### DT-002: acceso a datos

Se utilizará MySQL directamente mediante SQL y `mysql2/promise`. No se usará
Prisma durante este MVP.

### DT-003: evolución del esquema

Antes de crear las tablas se definirá el modelo conceptual mínimo del MVP. La
implementación se hará progresivamente mediante migraciones SQL pequeñas,
numeradas y guardadas en el repositorio. Los datos iniciales se mantendrán en
scripts de seeds separados.

### DT-004: endpoint de salud

`GET /api/health` será una comprobación sencilla de que el proceso HTTP está
activo. La disponibilidad de MySQL se comprobará por separado para distinguir
un fallo del servidor web de un fallo de infraestructura.

### DT-005: organización de rutas

`app.ts` registrará un único router bajo `/api`. El router central compondrá las
rutas técnicas y las rutas propias de cada módulo para evitar que `app.ts`
crezca junto con la cantidad de funcionalidades.

La dirección final de una ruta se forma al combinar los segmentos registrados
en cada nivel:

```text
app.ts              routes/index.ts       health.routes.ts
/api            +   /health           +   /
                                         |
                                         +-- GET /api/health
```

`app.ts` solo conocerá el router principal y los middlewares globales. Cada
módulo conservará sus propias rutas y el router central se encargará de
conectarlas bajo `/api`.

### DT-006: estilo de funciones

Se preferirán arrow functions almacenadas en constantes para callbacks,
middlewares, controladores, servicios y utilidades. Se usarán declaraciones
tradicionales solamente cuando exista una razón técnica concreta.

### DT-007: errores internos

Los errores se registrarán con su detalle en el servidor, pero las respuestas
`500` no expondrán trazas ni información interna al cliente. La API responderá
un mensaje genérico y el middleware central mantendrá el formato consistente.

### DT-008: configuración del entorno

La configuración local se cargará desde `.env`, que permanecerá fuera de Git.
`.env.example` documentará las variables requeridas sin contener secretos. Zod
validará y transformará los valores antes de que el servidor abra el puerto o
se conecte a servicios de infraestructura.

### DT-009: compatibilidad de TypeScript y ESLint

TypeScript permanecerá fijado en la versión `6.0.3` mientras
`typescript-eslint` no declare compatibilidad con TypeScript 7. No se usarán
`--force` ni `--legacy-peer-deps` para ocultar conflictos entre dependencias.
La versión podrá actualizarse cuando todo el conjunto de herramientas sea
compatible y las verificaciones del proyecto continúen funcionando.

### DT-010: identidad del proyecto

La plataforma se llamará Sazora. Sus identificadores técnicos serán
`sazora-api` para el backend, `sazora-web` para el frontend y `sazora_db` para
la base de datos MySQL. Esta convención mantendrá alineados la marca, los
repositorios y los servicios sin mezclar sus responsabilidades.

### DT-011: comprobación de MySQL durante el arranque

Antes de abrir el puerto HTTP, el servidor ejecutará una consulta mínima
mediante el pool. Si MySQL no está disponible o las credenciales son inválidas,
el proceso registrará el error y terminará con código `1`. Esto evita presentar
como operativa una API que no puede acceder a su almacenamiento principal.

## Fuera del alcance del primer MVP

- Inventario, recetas y producción.
- Pedidos web a domicilio.
- Caja, arqueos y pagos en línea.
- Facturación electrónica.
- Integración con WhatsApp.
- Impresión térmica automática.

## Próximo paso

Definir el modelo conceptual mínimo del MVP, comenzando por las entidades del
negocio y sus relaciones antes de crear nuevas migraciones SQL.
