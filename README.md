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

**Bloque actual:** catálogo administrativo del MVP.

**Último avance verificado:** imágenes opcionales de categorías y productos con
carga, conversión a WebP, publicación, reemplazo y retiro comprobados desde
Postman y el navegador.

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
- [x] Definir el alcance multiempresa y el aislamiento entre negocios.
- [x] Definir la relación entre usuarios, negocios y roles.
- [x] Permitir varios roles por pertenencia mediante una relación intermedia.
- [x] Definir la relación entre categorías y productos.
- [x] Definir el tratamiento de adiciones, cancelaciones y reimpresiones.
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
- [x] Autenticación.
- [ ] Autorización.
- [x] Categorías.
- [x] Áreas de preparación.
- [x] Productos.
- [x] Mesas.
- [ ] Órdenes.
- [ ] Detalles de órdenes.
- [ ] Comandas.
- [ ] Adiciones.
- [ ] Cancelaciones.
- [ ] Historial de estados.
- [ ] Registro de reimpresiones.

### Validación y seguridad

- [x] Validar entradas con Zod.
- [x] Almacenar contraseñas con hash de bcrypt.
- [x] Implementar autenticación con JWT.
- [ ] Proteger variables sensibles.
- [ ] Validar roles y permisos.
- [ ] Validar transiciones de estado.
- [ ] Evitar confiar en precios o totales enviados por el frontend.

### Verificación

- [x] Preparar pruebas manuales con Postman.
- [ ] Ejecutar consultas de comprobación en MySQL.
- [ ] Verificar casos exitosos.
- [x] Verificar casos de error.
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
- [x] Documentar decisiones técnicas.
- [x] Documentar pendientes de etapas posteriores.

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

### DT-012: alcance multiempresa

Sazora permitirá alojar varios negocios independientes en una misma aplicación.
Las entidades operativas estarán asociadas a un negocio y el backend obtendrá
ese contexto desde la identidad autenticada, no desde un identificador enviado
libremente por el cliente. El MVP comenzará con una sola panadería y no incluirá
todavía sucursales, suscripciones ni administración global de la plataforma.

### DT-013: pertenencia de usuarios a negocios

`users` representará la identidad global de una persona y
`business_memberships` relacionará esa identidad con `businesses` y `roles`.
Así, las credenciales no tendrán que duplicarse si una persona participa en más
de un negocio. El negocio y el rol activos formarán parte del contexto de
autenticación utilizado por el backend para autorizar cada operación.

### DT-014: varios roles por pertenencia

Una pertenencia podrá tener varios roles mediante `business_membership_roles`.
Esta tabla relacionará `business_memberships` con `roles` y evitará asignaciones
duplicadas. El modelo permitirá que una persona cumpla varias funciones dentro
del mismo negocio sin duplicar su identidad ni sus credenciales.

### DT-015: categorías, productos y desactivación lógica

Cada producto pertenecerá a una sola categoría y ambas entidades estarán
asociadas a un negocio. Categorías y productos se desactivarán mediante un
estado lógico en lugar de eliminarse físicamente. Un producto solo estará
disponible para operaciones nuevas cuando tanto el producto como su categoría
estén activos. Las órdenes históricas conservarán el producto y el precio
registrado al momento de confirmar el pedido.

### DT-016: modificaciones de una comanda

Cada orden tendrá una sola comanda lógica. Una adición o cancelación posterior a
su envío modificará su contenido vigente, incrementará su versión y generará
una reimpresión identificada como modificada. Cada cambio e impresión conservará
el usuario responsable y la fecha en sus respectivos registros de auditoría.

Los productos podrán eliminarse físicamente mientras la orden sea un borrador
que cocina no haya recibido. Después de confirmar la orden, un producto se
marcará como cancelado y se excluirá del total, pero permanecerá en el historial
con su motivo de cancelación. Así, una venta final no incluirá el producto sin
perder la explicación de lo ocurrido durante la preparación.

## Fuera del alcance del primer MVP

- Inventario, recetas y producción.
- Pedidos web a domicilio.
- Caja, arqueos y pagos en línea.
- Facturación electrónica.
- Integración con WhatsApp.
- Integraciones con CRM externos.
- Impresión térmica automática.
- Planes, suscripciones y cobros recurrentes a los negocios.

## Evolución posterior

### Imágenes del catálogo

Categorías y productos podrán tener una imagen opcional. MySQL no almacenará el
archivo binario ni contenido Base64; guardará una referencia estable al archivo
alojado en un servicio de almacenamiento de imágenes. La API deberá permitir
asignar, reemplazar y retirar esa imagen, además de validar tipo, tamaño y
propiedad por negocio. Este soporte se implementará después de cerrar el módulo
de mesas y antes de comenzar las órdenes.

### Planes y suscripciones

Sazora deberá permitir que cada negocio contrate un plan y pague una
suscripción recurrente por el uso de la plataforma. Este sistema será
independiente de los pagos realizados por los clientes de cada restaurante.

La implementación futura deberá contemplar planes, periodos de prueba,
renovaciones, cancelaciones, pagos fallidos, periodos de gracia y límites de
funcionalidades. El estado de la suscripción no se almacenará en
`businesses.is_active`, sino en entidades independientes relacionadas con el
negocio.

Sazora utilizará un proveedor externo para procesar los pagos y no almacenará
directamente números de tarjetas. Los webhooks y eventos del proveedor deberán
ser idempotentes y conservar trazabilidad.

Este módulo se implementará después del MVP operativo y antes del lanzamiento
comercial de la plataforma.

### Integraciones con CRM

Sazora deberá permitir que cada negocio conecte proveedores de CRM para
sincronizar clientes, actividad comercial y, cuando exista el módulo
correspondiente, ventas confirmadas. La integración pertenecerá al negocio,
aunque se registrará qué usuario la autorizó mediante su pertenencia.

Las credenciales externas se manejarán mediante OAuth o secretos cifrados; no
se almacenarán directamente en `users` ni como texto visible. Cada proveedor se
implementará mediante un adaptador aislado y las sincronizaciones, webhooks y
errores conservarán trazabilidad. Esta capacidad se abordará después de definir
clientes, caja, pagos y el evento que represente una venta definitiva.

## Próximo paso

Comenzar el módulo operativo de órdenes sobre las mesas, productos, membresías y
roles ya implementados.
