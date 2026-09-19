# Aprendizaje 006: imágenes del catálogo

## Objetivo

Permitir una imagen principal opcional para categorías y productos sin guardar
archivos binarios ni Base64 en MySQL.

## Diseño

MySQL almacena `image_url`. El archivo se procesa y almacena mediante una capa
separada. En desarrollo se utiliza `uploads/catalog`; esta separación permitirá
cambiar posteriormente a almacenamiento en nube.

Multer recibe un único campo `image` mediante `multipart/form-data`, con límite
de 5 MB. Sharp valida el contenido, corrige la orientación, limita las
dimensiones a 1600 por 1600 y genera WebP con un nombre aleatorio.

## Endpoints de categorías

```http
PUT /api/categories/:categoryId/image
DELETE /api/categories/:categoryId/image
```

El primer endpoint asigna o reemplaza la imagen. El segundo retira la referencia
y elimina el archivo local. Ambos utilizan el negocio contenido en el JWT.

## Endpoints de productos

```http
PUT /api/products/:productId/image
DELETE /api/products/:productId/image
```

Reutilizan el mismo middleware, transformación y almacenamiento. Las consultas
individuales y los listados incluyen `imageUrl`.

## Flujo del formulario

El frontend primero crea la categoría mediante JSON. Si el usuario seleccionó
una imagen, utiliza el identificador recibido para ejecutar una segunda petición
`multipart/form-data`. Si la imagen falla, la categoría permanece creada y la
carga puede reintentarse.

## Pruebas realizadas

- [x] Cargar una imagen PNG produce HTTP 200.
- [x] La imagen se convierte a WebP y queda disponible desde `/uploads`.
- [x] Retirar la imagen produce HTTP 200 y establece `imageUrl` en `null`.
- [x] Reasignar una imagen produce HTTP 200.
- [x] Asignar una imagen a un producto produce HTTP 200.
- [x] La consulta del producto devuelve su `imageUrl`.
- [x] Retirar y reasignar la imagen del producto produce HTTP 200.
- [x] Las imágenes se sirven públicamente con tipo `image/webp`.

## Pendientes

- Sustituir el almacenamiento local por almacenamiento persistente antes de producción.
