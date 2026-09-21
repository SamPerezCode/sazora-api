# Aprendizaje 008: administración multiempresa de Sazora

## Objetivo

Registrar cómo se separará la operación de cada negocio de la administración
global de Sazora, antes de implementar planes, suscripciones y facturación.

## Contexto multiempresa actual

El inicio de sesión de un negocio ya utiliza `email`, `password` y
`businessSlug`. El repositorio valida conjuntamente el usuario, la pertenencia
activa, el negocio activo y los roles activos. El JWT conserva `userId`,
`businessId`, `membershipId` y los roles correspondientes al negocio elegido.

Una misma identidad podrá pertenecer a varios negocios y obtener un JWT
diferente para cada contexto. Todas las consultas operativas deben continuar
obteniendo el negocio desde ese token, nunca desde un `businessId` libre enviado
por el cliente.

## Pertenencia y suscripción no son lo mismo

`business_memberships` representa la relación laboral u operativa entre una
persona y un negocio. No representa el plan comercial de Sazora ni un pago.

Las suscripciones se modelarán posteriormente mediante entidades separadas,
por ejemplo:

- `plans`.
- `business_subscriptions`.
- `subscription_periods`.
- `courtesy_grants`.
- `billing_events`.
- `payments`.

El estado comercial no debe almacenarse únicamente en `businesses.is_active`,
porque una suspensión operativa, una prueba, una cortesía y un pago vencido son
situaciones diferentes que necesitan historial.

## Dos niveles administrativos

El rol empresarial `ADMIN` administra exclusivamente el negocio contenido en
su JWT: empleados, catálogo, mesas, órdenes y configuración. No puede consultar
ni modificar otros establecimientos.

El futuro `PLATFORM_ADMIN` será una autoridad global e interna de Sazora. Podrá
administrar negocios, planes, periodos de prueba, cortesías, pagos, suspensiones
y métricas generales. No se modelará como una pertenencia a un negocio.

## Autenticación de plataforma

La administración global utilizará rutas y tokens separados, por ejemplo:

```http
POST /api/platform/auth/login
GET /api/platform/businesses
POST /api/platform/businesses/:businessId/courtesy-periods
```

Los tokens distinguirán `BUSINESS_MEMBER` de `PLATFORM_ADMIN`. Un token global
no reutilizará accidentalmente rutas administrativas de un establecimiento y
un `ADMIN` empresarial nunca obtendrá permisos globales.

## Seguridad al incorporar empleados

El correo de `users` es globalmente único. Si el correo no existe, el negocio
puede crear una identidad nueva, su pertenencia y sus roles. Si ya existe, no
se debe cambiar su contraseña ni vincular la cuenta automáticamente: se
utilizará un flujo de invitación y aceptación para impedir que un administrador
agregue arbitrariamente una identidad perteneciente a otro negocio.

El primer endpoint de empleados permitirá crear cuentas nuevas. Ante un correo
existente responderá un conflicto explícito y el soporte de invitaciones se
implementará posteriormente.

## Orden de implementación

1. Completar y validar el flujo operativo de un solo negocio, inicialmente
   MOKAI.
2. Implementar empleados y roles empresariales.
3. Completar las operaciones de comandas e impresión pendientes.
4. Construir y probar el frontend operativo.
5. Crear el plano administrativo global de Sazora.
6. Implementar planes, suscripciones, cortesías y facturación.
7. Integrar un proveedor externo de pagos y sus webhooks.

Esta secuencia permite validar primero el producto que utilizarán los negocios
sin renunciar al aislamiento multiempresa necesario para comercializarlo.
