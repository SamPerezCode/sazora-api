# Productos, inventario automático y combos

## 1. Objetivo

Registrar productos vendibles sin obligar al administrador a crear manualmente
el artículo de inventario y su relación, y permitir combos que consuman varios
productos mediante una sola configuración.

## 2. Productos normales

`POST /api/products` crea un producto del catálogo. Acepta JSON cuando no se
envía imagen y `multipart/form-data` cuando se incluye el archivo opcional
`image`.

La creación del producto no obliga a administrar inventario. Un servicio o un
producto preparado al momento puede permanecer sin relación de inventario.

## 3. Configuración automática de inventario

`POST /api/products/:productId/inventory-setup` configura inventario para un
producto existente.

- `RESALE` crea un artículo `RESALE_GOOD`.
- `PRODUCTION` crea un artículo `FINISHED_GOOD`.
- `openingQuantity` genera un movimiento `OPENING` cuando es mayor que cero.
- `quantityPerProduct` define cuánto se descuenta por unidad vendida.

La creación del artículo, el movimiento inicial y la relación se ejecutan en
una sola transacción.

## 4. Productos combo

`POST /api/products/combos` crea el producto, conserva sus componentes y genera
sus relaciones de inventario dentro de una sola transacción. La imagen es
opcional.

Cada componente se identifica mediante el ID de un producto activo que ya tenga
inventario configurado. El backend copia sus consumos, los multiplica por la
cantidad incluida en el combo y agrupa los artículos repetidos.

Ejemplo:

```text
Combo viernes
├── 5 panes de queso
├── 2 burritos
└── 1 malteada
```

Al vender dos combos se descuentan diez panes, cuatro burritos y dos veces el
inventario configurado para la malteada.

El combo no debe ejecutar `inventory-setup`, porque no conserva stock propio:
consume directamente el inventario calculado desde sus componentes.

## 5. Consulta y edición

- `GET /api/products/combos/:comboProductId` devuelve producto, componentes y
  relaciones de inventario.
- `PATCH /api/products/combos/:comboProductId` actualiza datos comerciales,
  componentes, cantidades e imagen.
- `DELETE /api/products/:productId/image` también retira la imagen de un combo.

Cuando cambia `components`, el arreglo recibido reemplaza toda la composición.
El backend vuelve a calcular las relaciones dentro de una transacción. Los
movimientos históricos no se modifican.

## 6. Venta y cancelación

El inventario no cambia mientras la orden permanezca `OPEN`. Al confirmar, cada
línea genera un movimiento `SALE` con referencia al `orderItemId`.

La existencia puede quedar negativa y no bloquea la venta. Al cancelar una
línea confirmada, un movimiento `REVERSAL` devuelve exactamente las cantidades
registradas en la venta original.

## 7. Imágenes

Los productos normales y combos aceptan JPEG, PNG o WebP de hasta 5 MB. El
backend convierte la imagen a WebP y guarda una ruta relativa bajo `/uploads/`.
El frontend construye la URL completa concatenando el origen de la API.

## 8. Pruebas aplazadas

Las pruebas integrales de compras, producción, ventas, saldos negativos,
reversiones y combos se ejecutarán al construir la interfaz de inventario. El
objetivo es validar simultáneamente la API y el flujo real del frontend.
