# Inventario y producción: diseño inicial y evolución

## 1. Objetivo

Definir una base de inventario multiempresa que permita controlar insumos,
productos preparados, mercancía de reventa y productos terminados, sin limitar
la producción a cantidades o recetas fijas.

El diseño debe servir para panaderías, cafeterías, restaurantes y otros negocios
que transformen materiales o vendan artículos comprados a terceros.

## 2. Principio principal

El inventario no se representará únicamente con un campo `stock` dentro de
`products`. El catálogo de venta y el inventario tienen responsabilidades
diferentes:

- `products` representa lo que el cliente puede comprar.
- Los artículos de inventario representan lo que el negocio almacena, transforma
  o consume.
- Los movimientos constituyen el historial contable de las cantidades.
- Una relación explícita indicará qué inventario consume cada producto vendido.

## 3. Tipos de artículos

La primera versión contemplará:

- `RAW_MATERIAL`: harina, queso, carne cruda y otros insumos.
- `SEMI_FINISHED`: carne preparada, salsas o masas intermedias.
- `FINISHED_GOOD`: panes, postres o porciones terminadas.
- `RESALE_GOOD`: gaseosas y productos adquiridos para reventa.

Cada artículo pertenecerá a un negocio y tendrá nombre, SKU opcional, tipo,
unidad base, stock actual, stock mínimo y estado activo.

## 4. Cantidades y unidades

Las cantidades utilizarán `DECIMAL`, nunca `FLOAT` ni `DOUBLE`.

La primera versión utilizará una unidad base por artículo, por ejemplo:

- `UNIT`.
- `GRAM`.
- `KILOGRAM`.
- `MILLILITER`.
- `LITER`.
- `PORTION`.
- `PACKAGE`.

Todos los movimientos de un artículo se expresarán inicialmente en su unidad
base. Las conversiones automáticas entre arrobas, kilogramos, cajas y unidades
se implementarán en una etapa posterior.

## 5. Libro de movimientos

El stock debe poder explicarse mediante movimientos inmutables. La primera
versión reconocerá:

- `OPENING`: existencia inicial.
- `PURCHASE`: ingreso por compra.
- `PRODUCTION`: consumos y resultados de producción.
- `SALE`: salida asociada a una orden confirmada.
- `ADJUSTMENT`: corrección positiva o negativa.
- `WASTE`: pérdida, daño o vencimiento.
- `RETURN`: devolución.
- `REVERSAL`: compensación de otro movimiento.

Cada movimiento tendrá una cabecera y una o varias líneas. Cada línea tendrá
dirección `IN` u `OUT`, una cantidad positiva y una nota opcional.

El saldo actual podrá mantenerse materializado para consultas rápidas, pero
siempre deberá coincidir con el libro de movimientos. Las actualizaciones se
ejecutarán dentro de una transacción y bloquearán los artículos afectados.

## 6. Producción dinámica

La producción registrará las cantidades reales consumidas y obtenidas en cada
jornada. No exigirá que todos los días se utilice una cantidad fija.

Ejemplo de una jornada:

```json
{
  "type": "PRODUCTION",
  "notes": "Producción de pan de queso talla L",
  "lines": [
    {
      "inventoryItemId": "1",
      "direction": "OUT",
      "quantity": "25.000",
      "notes": "Harina utilizada"
    },
    {
      "inventoryItemId": "2",
      "direction": "OUT",
      "quantity": "8.500",
      "notes": "Queso utilizado"
    },
    {
      "inventoryItemId": "8",
      "direction": "IN",
      "quantity": "100.000",
      "notes": "Panes talla L producidos"
    }
  ]
}
```

Otra jornada podrá consumir la mitad y producir 50 unidades. El sistema
registrará el resultado real, no una expectativa fija.

El mismo modelo permite consumir 20 kg de carne y producir 100 porciones, o
consumir 10 kg al día siguiente y producir 50 porciones.

## 7. Relación con productos de venta

Una relación multiempresa asociará productos del catálogo con artículos de
inventario. Como mínimo conservará:

- `productId`.
- `inventoryItemId`.
- `quantityPerProduct`.
- `autoDeduct`.

Ejemplos:

- Una gaseosa vendida consume una unidad del artículo de reventa.
- Un pan de queso talla L consume una unidad del producto terminado.
- Un plato puede consumir una o varias porciones o ingredientes mediante varias
  relaciones activas.
- Un combo conserva sus productos componentes y genera automáticamente las
  relaciones necesarias para descontar sus inventarios.

Para reducir pasos manuales, un producto de venta puede configurar su inventario
mediante `POST /api/products/:productId/inventory-setup`. La operación crea, en
una sola transacción, el artículo de inventario, el movimiento de apertura cuando
corresponda y la relación con el producto.

Los productos comprados para reventa se configuran como `RESALE_GOOD`; sus
compras aumentan el saldo y sus ventas lo disminuyen. Los productos obtenidos
mediante producción se configuran como `FINISHED_GOOD`; los movimientos de
producción aumentan el saldo y sus ventas lo disminuyen.

## 8. Descuento automático

Agregar productos a una orden `OPEN` no modificará inventario porque la orden
todavía es un borrador.

El descuento se realizará al confirmar la orden. En una sola transacción se
deberá:

1. Bloquear la orden y los artículos relacionados.
2. Recuperar y bloquear los saldos vigentes.
3. Crear el movimiento `SALE` y sus líneas `OUT`.
4. Actualizar los saldos.
5. Confirmar la orden.
6. Crear las comandas.

El stock insuficiente no bloquea la confirmación. Si la persona responsable
verificó físicamente el producto, el saldo puede quedar negativo para reflejar
la diferencia entre la existencia registrada y la existencia real. Una compra,
producción o ajuste posterior balanceará nuevamente el saldo.

Ejemplo: un artículo con saldo `0.000` vendido en dos unidades quedará en
`-2.000`. Si posteriormente ingresan cinco unidades, su nuevo saldo será
`3.000`.

La cancelación posterior de un producto confirmado creará un movimiento de
reversión. Los movimientos originales nunca se eliminarán.

La operación será idempotente mediante referencias únicas al origen para evitar
descontar dos veces la misma línea de una orden.

## 9. Primera versión prevista

La primera versión incluirá:

- Catálogo de artículos de inventario.
- Stock inicial.
- Stock mínimo y alertas.
- Compras como movimientos de entrada.
- Ajustes positivos y negativos.
- Pérdidas.
- Producción con múltiples consumos y resultados.
- Historial de movimientos.
- Relación con productos de venta.
- Configuración automática del inventario de productos de reventa y producción.
- Productos combo con múltiples componentes.
- Descuento al confirmar una orden.
- Saldos negativos sin bloquear la operación.
- Reversión al cancelar una línea confirmada.

## 10. Funciones aplazadas

Después de validar la primera versión se podrán agregar:

- Unidades configurables y conversiones automáticas.
- Recetas estándar y comparación entre consumo esperado y real.
- Costeo promedio, último costo y costo de producción.
- Proveedores.
- Órdenes de compra con estados y recepción parcial.
- Varias bodegas y transferencias.
- Lotes, fechas de vencimiento y trazabilidad sanitaria.
- Conteos físicos y cierres de inventario.
- Reservas de stock para canales públicos.
- Pronósticos y sugerencias de producción.
- Aprobaciones de movimientos sensibles.
- Reportes de rendimiento, merma y rentabilidad.

## 11. Carpetas previstas en Postman

```text
Inventory
Inventory Movements
Production
Product Inventory Links
```

## 12. Orden de implementación

1. [x] Artículos y stock inicial.
2. [x] Libro de movimientos manuales.
3. [x] Producción dinámica.
4. [x] Relación con productos del catálogo.
5. [x] Configuración automática producto-inventario.
6. [x] Consumo automático al confirmar.
7. [x] Reversiones de cancelación.
8. [x] Productos combo y consumo de múltiples artículos.
9. [x] Alertas y consultas para el frontend.
10. [ ] Pruebas integrales junto con la interfaz de inventario.
