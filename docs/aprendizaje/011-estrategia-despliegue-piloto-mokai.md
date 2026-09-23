# Estrategia de despliegue del piloto de Mokai

## 1. Propósito del documento

Este documento registra la decisión arquitectónica y operativa para desplegar la primera versión productiva de Sazora utilizando a Mokai como negocio piloto.

El objetivo es validar la aplicación en un negocio real sin convertir el código en una aplicación exclusiva de Mokai ni abandonar la arquitectura multiempresarial.

## 2. Decisión principal

Sazora continuará siendo un único producto multiempresarial.

Mokai utilizará inicialmente una instalación productiva aislada, alojada con la infraestructura y el dominio disponibles para el piloto. Esta instalación podrá contener solamente los datos de Mokai, pero conservará toda la estructura multiempresarial de Sazora.

La decisión se resume así:

```text
Un solo producto: Sazora
Un solo repositorio de código
Una instalación piloto dedicada: Mokai
Una base de datos piloto: solamente Mokai
Un dominio temporal: el disponible para Mokai
```

Esta estrategia permite probar el sistema con aislamiento sin crear una versión diferente del producto.

## 3. Lo que debe conservarse

Aunque la primera instalación solo atienda a Mokai, deben conservarse:

- El campo `business_id` en las tablas que pertenecen a un negocio.
- La selección del negocio mediante `businessSlug` durante la autenticación.
- La validación del negocio autenticado en repositorios y servicios.
- Las salas Socket.IO separadas por negocio, membresía y rol.
- La configuración mediante variables de entorno.
- Un único repositorio y una única línea principal de desarrollo.

No se deben reemplazar identificadores de negocio por valores fijos asociados a Mokai.

## 4. Arquitectura del piloto

Durante el piloto podrían utilizarse direcciones pertenecientes a Mokai, por ejemplo:

```text
Frontend: https://app.mokai.com
API:      https://api.mokai.com
Socket:   wss://api.mokai.com
```

Estos nombres son ejemplos. Los subdominios reales dependerán del dominio y de la infraestructura disponibles.

La aplicación puede presentarse como:

```text
Mokai
Tecnología proporcionada por Sazora
```

El dominio indica dónde está desplegada la aplicación. El negocio continúa identificándose mediante su registro en la base de datos y su `businessSlug`.

Por ejemplo:

```json
{
  "businessSlug": "mokai-panaderia-cafe",
  "email": "usuario@mokai.com",
  "password": "contraseña-del-usuario"
}
```

## 5. Traslado futuro al dominio de Sazora

Cuando Sazora cuente con dominio e infraestructura propios, la aplicación podrá utilizar direcciones como:

```text
Frontend: https://app.sazora.com
API:      https://api.sazora.com
Socket:   wss://api.sazora.com
```

Mokai continuará siendo el mismo negocio dentro de la plataforma. No será necesario volver a crear:

- El negocio.
- Los administradores y empleados.
- Las categorías y productos.
- Las mesas y áreas de preparación.
- Las órdenes y comandas históricas.
- Las configuraciones operativas.

El cambio de dominio será principalmente una operación de infraestructura y despliegue, no una reconstrucción de la aplicación.

Si también cambia el servidor, será necesario trasladar o conectar:

- La base de datos MySQL.
- Las imágenes y demás archivos persistentes.
- Las variables de entorno y secretos.
- La configuración de correo.
- Los certificados HTTPS.
- Las copias de seguridad.

## 6. Variables que deben permanecer configurables

El backend no debe contener dominios escritos directamente en el código. Las direcciones públicas deben configurarse mediante variables de entorno.

Ejemplo durante el piloto:

```env
CLIENT_ORIGIN=https://app.mokai.com
API_PUBLIC_URL=https://api.mokai.com
PASSWORD_RESET_URL_BASE=https://app.mokai.com/reset-password
```

Ejemplo después del traslado:

```env
CLIENT_ORIGIN=https://app.sazora.com
API_PUBLIC_URL=https://api.sazora.com
PASSWORD_RESET_URL_BASE=https://app.sazora.com/reset-password
```

El frontend también deberá utilizar variables de entorno:

```env
VITE_API_URL=https://api.sazora.com
VITE_SOCKET_URL=https://api.sazora.com
```

Los nombres concretos podrán cambiar cuando se cree el frontend, pero no deben reemplazarse por direcciones fijas dentro de los componentes.

## 7. Alternativas para Mokai después del piloto

Después de validar el sistema existen tres alternativas:

### 7.1. Mantener una instalación dedicada

Mokai conserva una instancia y una base de datos propias, pero utiliza el mismo código de Sazora.

Esta alternativa ofrece mayor aislamiento, aunque aumenta el trabajo de infraestructura y mantenimiento.

### 7.2. Migrar Mokai a la plataforma compartida

Los datos de Mokai se trasladan a la infraestructura multiempresarial general de Sazora.

Mokai se identifica mediante `business_id` y `businessSlug`, igual que los demás negocios.

### 7.3. Utilizar un subdominio personalizado

Mokai puede ingresar mediante una dirección como:

```text
https://mokai.sazora.com
```

El subdominio puede permitir que el frontend seleccione automáticamente el negocio. También puede mantenerse un acceso general mediante:

```text
https://app.sazora.com
```

En ese acceso general, el negocio puede seleccionarse mediante el `businessSlug` durante el inicio de sesión.

## 8. Acciones que deben evitarse

No se debe:

- Copiar el repositorio para crear un proyecto independiente de Mokai.
- Eliminar la arquitectura multiempresarial.
- Eliminar `business_id` de las tablas.
- Mantener una rama permanente con funcionalidades exclusivas para Mokai.
- Duplicar correcciones y módulos en dos proyectos diferentes.
- Vincular la identidad técnica de Sazora a un dominio que no controla.
- Depender únicamente del disco temporal del servidor para guardar imágenes.

Si Mokai necesita configuraciones o funciones particulares, deben evaluarse como configuración por negocio o mediante funcionalidades habilitables, no como una copia separada del sistema.

## 9. Requisitos antes de producción

Antes de comenzar el piloto deben completarse, como mínimo:

- Dominio o subdominios configurados mediante DNS.
- Certificados HTTPS válidos.
- Proxy inverso compatible con HTTP y WebSocket.
- Conexiones Socket.IO mediante `wss://`.
- Base de datos MySQL productiva.
- Usuario de base de datos con permisos limitados.
- Ejecución controlada de migraciones.
- Copias de seguridad automáticas y pruebas de restauración.
- Almacenamiento persistente para imágenes.
- Gestión segura de variables y secretos.
- Configuración productiva del correo electrónico.
- Registros de errores y monitoreo básico.
- Ambiente de pruebas separado del ambiente productivo.
- Procedimiento de despliegue y reversión.

## 10. Procedimiento futuro de cambio de dominio

Cuando Sazora obtenga su dominio propio, el traslado seguirá aproximadamente este proceso:

1. Preparar el nuevo servidor o servicio de alojamiento.
2. Desplegar la misma versión del backend y del frontend.
3. Preparar la base de datos y ejecutar sus migraciones.
4. Copiar o conectar los datos productivos de Mokai.
5. Migrar las imágenes y archivos persistentes.
6. Configurar los secretos y las variables del nuevo ambiente.
7. Configurar DNS y certificados HTTPS.
8. Configurar el proxy para HTTP y Socket.IO.
9. Probar autenticación, permisos, imágenes, correos, órdenes y tiempo real.
10. Realizar el cambio definitivo de tráfico.
11. Mantener temporalmente una redirección desde el dominio anterior, si es posible.
12. Verificar las copias de seguridad antes de retirar la instalación anterior.

## 11. Propiedad, acceso y responsabilidades

Aunque Mokai pague inicialmente el dominio o el servidor, conviene acordar por escrito:

- Que Sazora conserva la propiedad del código y del producto.
- Que Mokai conserva los derechos correspondientes sobre sus datos comerciales.
- Quién administra el dominio, el servidor y la base de datos.
- Quién conserva y verifica las copias de seguridad.
- Qué personas tienen acceso a las credenciales productivas.
- Cómo se exportan o migran los datos.
- Qué sucede con la infraestructura y los datos al terminar el piloto.
- Quién asume los costos de infraestructura, soporte y mantenimiento.

Estas condiciones deben revisarse con profesionales contables y legales antes del lanzamiento comercial.

## 12. Membresías y pagos de Sazora

La gestión comercial de las membresías de los negocios no se implementará durante la instalación piloto alojada con el dominio o la infraestructura de Mokai.

Esta etapa incluye:

- Planes con pago mensual.
- Planes con pago anual.
- Renovaciones de membresía.
- Fechas de vencimiento.
- Estados de suscripción.
- Suspensión por falta de pago.
- Meses o periodos de cortesía.
- Historial de pagos.
- Facturación y comprobantes.
- Integración con una pasarela de pagos.
- Administración centralizada de varios negocios por parte de Sazora.

Estas funciones se implementarán cuando Sazora cuente con un dominio e infraestructura propios y pueda operar como plataforma independiente.

Durante el piloto:

- Mokai será el negocio autorizado para utilizar la instalación.
- No habrá cobros automáticos de membresía dentro de la aplicación.
- No se suspenderá automáticamente el acceso por vencimientos.
- Cualquier acuerdo económico o periodo de cortesía se administrará externamente.
- La arquitectura continuará preparada para agregar posteriormente el módulo comercial sin convertir Mokai en una aplicación independiente.

La ausencia temporal de cobros automáticos no significa que debamos eliminar el concepto de negocio, membresía o roles existente en el sistema. Las membresías actuales representan la relación entre un usuario y un negocio; el futuro módulo de suscripciones representará la relación comercial entre Sazora y cada negocio.

Por lo tanto, deben mantenerse separados estos conceptos:

```text
Membresía de usuario
Usuario pertenece a un negocio y tiene determinados roles.

Suscripción comercial
El negocio paga a Sazora por utilizar la plataforma.
```

Cuando Sazora tenga dominio propio, se diseñará el módulo de administración de plataforma para gestionar planes, pagos, renovaciones, cortesías y estados de suscripción de todos los negocios.

## 13. Conclusión

La estrategia acordada es:

```text
Código multiempresarial de Sazora
        ↓
Instalación piloto aislada para Mokai
        ↓
Validación durante desarrollo y producción
        ↓
Dominio e infraestructura propios de Sazora
        ↓
Mokai continúa como negocio de Sazora
        ↓
Incorporación de nuevos negocios
```

El piloto de Mokai no cambia la identidad ni la arquitectura de Sazora. Solamente representa su primera instalación productiva.

## 14. Referencias técnicas

- [Deployment Stamps pattern - Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/deployment-stamp)
- [Tenancy models for a multitenant solution - Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)
- [Socket.IO](https://socket.io/)
