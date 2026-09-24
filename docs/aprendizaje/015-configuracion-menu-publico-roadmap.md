# Configuración del negocio, menú público y solicitudes

## 1. Objetivo

Definir la información configurable de cada negocio, la publicación de su menú
y el flujo seguro mediante el cual un cliente externo puede enviar una solicitud
de pedido.

## 2. Estado actual

Actualmente `businesses` conserva nombre, slug, zona horaria, moneda y estado.
No existen todavía endpoints administrativos para editar esos datos ni campos
para teléfono, dirección, marca, texto de comanda o menú público.

El catálogo, sus imágenes y las áreas de preparación ya existen, pero todos sus
endpoints requieren autenticación. No existe una lectura pública del menú.

## 3. Configuración del negocio

La configuración deberá conservar:

- Nombre comercial.
- Eslogan.
- Teléfono.
- Dirección visible.
- Texto visible de horario.
- Instagram.
- Identificación fiscal privada.
- Logo.
- Color principal y color de acento.
- Texto final de la comanda.
- Descripción principal del menú público.
- Estado de publicación del menú.
- Estado de recepción de solicitudes públicas.

Los endpoints administrativos obtendrán el negocio desde el JWT. El endpoint
público nunca expondrá la identificación fiscal ni opciones internas.

## 4. Menú público

El menú se resolverá mediante el `businessSlug`:

```http
GET /api/public/businesses/:businessSlug/menu
```

Solo devolverá negocios activos con menú habilitado, categorías activas y
productos activos y disponibles.

## 5. Solicitud pública separada de una orden

Un visitante anónimo no creará directamente una orden operativa ni una comanda.
Primero creará una solicitud con información de contacto y una copia de los
productos y precios seleccionados.

Estados previstos:

- `NEW`.
- `CONTACTED`.
- `ACCEPTED`.
- `REJECTED`.
- `CANCELLED`.

Cuando una persona autorizada acepte la solicitud, el backend creará la orden
interna y la enlazará con la solicitud. La confirmación posterior seguirá el
flujo normal de comandas e inventario.

## 6. Responsable de pedidos públicos

La recepción no se asignará únicamente mediante un empleado fijo. El negocio
podrá programar responsables por fecha, día de la semana y franja horaria.

Una asignación conservará, como mínimo:

- Negocio.
- Membresía responsable.
- Tipo de canal, inicialmente `PUBLIC_ORDER` o `DELIVERY`.
- Fecha específica opcional.
- Día de la semana opcional.
- Hora inicial y final.
- Prioridad.
- Estado activo.
- Persona que creó o modificó la asignación.

Una fecha específica tendrá prioridad sobre una regla semanal. Esto permitirá
indicar, por ejemplo, que un mesero concreto atiende domicilios un miércoles,
aunque normalmente exista otra programación.

## 7. Supervisión y respaldo

Los responsables vigentes recibirán la notificación principal. Los usuarios con
rol `ADMIN` también podrán consultar todas las solicitudes.

En una etapa posterior se podrá agregar un rol `SUPERVISOR`. Mientras ese rol no
exista, el administrador actuará como respaldo.

Si no hay una asignación vigente, la notificación se enviará a los
administradores para evitar que el pedido quede sin atención.

## 8. Eventos de tiempo real

El evento inicial será:

```text
public-order-request:created
```

Se emitirá a las salas de las membresías asignadas y a la sala administrativa
del negocio. Otros eventos previstos son:

- `public-order-request:status-updated`.
- `public-order-request:accepted`.

## 9. Comunicación antes de WhatsApp API

La primera versión guardará nombre, teléfono con código de país y correo
opcional. El frontend permitirá llamar, copiar el teléfono o abrir una URL de
WhatsApp para iniciar la conversación externamente.

La sincronización de mensajes dentro de Sazora requerirá posteriormente la API
de WhatsApp, plantillas aprobadas, webhooks y almacenamiento de conversaciones.

## 10. Seguridad pública

Antes de producción deberán incorporarse:

- Límite de solicitudes por IP y negocio.
- Protección contra automatización o CAPTCHA cuando sea necesario.
- Validación estricta del teléfono.
- Identificadores públicos no predecibles para seguimiento.
- Registro de aceptación y rechazo.
- Idempotencia para evitar solicitudes duplicadas.
- Política de tratamiento de datos personales.

## 11. Carpetas previstas en Postman

```text
Business Settings
Public Menu
Public Order Requests
Public Order Assignments
```

## 12. Orden de implementación

1. Configuración e información del negocio.
2. Marca, logo y personalización de comandas.
3. Configuración de publicación.
4. Lectura pública del menú.
5. Programación de responsables.
6. Creación de solicitudes públicas.
7. Notificaciones Socket.IO dirigidas.
8. Gestión y aceptación de solicitudes.
9. Conversión en una orden operativa.

## 13. Pendientes posteriores a la primera versión

- Horarios estructurados con múltiples franjas por día.
- Excepciones por festivos y cierres temporales.
- Cobertura y costo de domicilio por zonas.
- Tiempo estimado y capacidad máxima de pedidos.
- Pago en línea.
- Seguimiento público del pedido.
- Mensajería integrada con WhatsApp.
- Rol empresarial de supervisor.
- Reasignación automática si el responsable no responde.
- Métricas de aceptación, rechazo y tiempo de contacto.

## 14. Cómo mostrar el logo en el frontend

El backend conserva y devuelve `logoUrl` como una ruta relativa. Por ejemplo:

```json
{
  "logoUrl": "/uploads/business-logos/archivo.webp"
}
```

La base de datos no debe guardar `http://localhost:3000` ni un dominio de
producción. De esta manera, el mismo registro continúa funcionando cuando la
API cambia de servidor o de dominio.

En un frontend creado con Vite, el origen público del backend se configura en
una variable de entorno:

```env
VITE_API_ORIGIN=http://localhost:3000
```

En producción únicamente se reemplaza su valor:

```env
VITE_API_ORIGIN=https://api.sazora.com
```

La URL completa se obtiene concatenando el origen con la ruta entregada por el
backend:

```ts
const getPublicAssetUrl = (path: string | null): string | null => {
  if (!path) {
    return null;
  }

  return `${import.meta.env.VITE_API_ORIGIN}${path}`;
};

const logoUrl = getPublicAssetUrl(settings.logoUrl);
```

Ejemplo de presentación en React:

```tsx
{logoUrl ? (
  <img src={logoUrl} alt={`Logo de ${settings.name}`} />
) : (
  <span>{settings.name}</span>
)}
```

La concatenación correcta es:

```text
http://localhost:3000 + /uploads/business-logos/archivo.webp
```

No se debe agregar nuevamente `/uploads/business-logos`, porque `logoUrl` ya
incluye esa parte. Duplicarla produce una ruta inexistente.

Esta misma regla aplica a las imágenes de categorías, productos y demás
archivos públicos cuya URL comience con `/uploads/`.
