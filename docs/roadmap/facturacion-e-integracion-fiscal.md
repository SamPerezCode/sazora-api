# Facturación, pagos, caja e integración fiscal de Sazora

Estado: Planeado para una etapa posterior
Última revisión: 5 de octubre de 2026

## 1. Decisión de arquitectura

Sazora separará dos responsabilidades:

1. Sazora administrará la operación completa del restaurante.
2. Un software fiscal habilitado o proveedor tecnológico autorizado se encargará de generar y transmitir los documentos fiscales a la DIAN.

Inicialmente, Sazora no generará directamente facturas electrónicas ni documentos equivalentes electrónicos.

La estrategia preferida será integrar Sazora mediante API con el software de facturación utilizado por cada negocio.

Esta separación permite desarrollar pagos, caja, ventas, clientes y comprobantes internos sin convertir inmediatamente a Sazora en un software fiscal habilitado.

## 2. Alcance operativo de Sazora

Sazora podrá administrar:

- Pedidos de mesa.
- Pedidos para recoger.
- Domicilios.
- Comandas de cocina.
- Estados de preparación y entrega.
- Productos y combos.
- Inventario.
- Producción.
- Empleados y roles.
- Pagos.
- Métodos de pago.
- Aperturas y cierres de caja.
- Turnos de caja.
- Cuentas por cobrar.
- Clientes.
- Historial de ventas.
- Devoluciones y anulaciones internas.
- Precuentas.
- Comprobantes internos de pago.
- Reimpresiones.
- Integración con proveedores de facturación.

Sazora podrá registrar toda la operación comercial aunque el documento fiscal sea emitido por otro sistema.

## 3. Responsabilidad fiscal externa

La emisión fiscal será responsabilidad de uno de estos mecanismos:

- Servicio de facturación gratuita de la DIAN.
- Software propio habilitado para facturación electrónica.
- Proveedor tecnológico habilitado por la DIAN.
- Software de facturación utilizado por el restaurante que disponga de API.

La DIAN reconoce estas alternativas como modos de operación para facturar electrónicamente. Cuando se utilice un proveedor tecnológico, debe verificarse que aparezca en el catálogo oficial de proveedores habilitados.

Sazora no afirmará estar certificada, autorizada o habilitada por la DIAN mientras no complete formalmente el proceso correspondiente.

## 4. Comprobantes internos

Mientras un negocio no tenga una integración fiscal activa, Sazora podrá generar documentos operativos como:

- Precuenta.
- Comprobante de pedido.
- Comprobante interno de pago.
- Recibo interno.
- Resumen de compra.
- Comprobante interno de venta.

Estos documentos podrán contener:

- Nombre o razón social.
- Nombre comercial.
- NIT.
- Dirección.
- Teléfono.
- Número interno de la orden.
- Fecha y hora.
- Mesa o tipo de servicio.
- Productos.
- Cantidades.
- Precios.
- Subtotal.
- Descuentos.
- Impuestos informativos, cuando corresponda.
- Total pagado.
- Métodos de pago.
- Cajero.
- Estado del pago.

Mientras no sean documentos fiscales válidos, deberán incluir una leyenda visible como:

> COMPROBANTE INTERNO DE PAGO
> Este documento no constituye factura de venta ni documento equivalente.

La redacción definitiva deberá revisarse con un contador o asesor tributario antes de poner el sistema en producción.

Los documentos internos no deberán denominarse:

- Factura.
- Factura electrónica.
- Factura POS.
- Documento equivalente.
- Documento equivalente electrónico.

Tampoco deberán utilizar elementos gráficos o textos que hagan pensar que fueron validados por la DIAN.

## 5. Límite del comprobante interno

Un comprobante interno no sustituye las obligaciones fiscales del restaurante.

Cuando el negocio esté obligado a facturar, deberá expedir el documento fiscal correspondiente mediante un modo de operación válido.

Sazora no asumirá que registrar un pago o imprimir un recibo interno equivale a emitir una factura.

El negocio seguirá siendo responsable de:

- Su obligación de facturar.
- La autorización de numeración.
- La configuración tributaria.
- Los impuestos aplicables.
- La identificación del adquirente cuando corresponda.
- La emisión de notas crédito o débito.
- Los procedimientos de contingencia.
- La conservación de los documentos fiscales.

## 6. Modos futuros de funcionamiento

Cada negocio podrá seleccionar una configuración de facturación.

### 6.1 Sin integración fiscal

Sazora:

1. Registra la orden.
2. Registra el pago.
3. Actualiza la caja.
4. Cierra la cuenta.
5. Genera un comprobante interno.
6. Marca la venta como pendiente de registro fiscal externo, cuando corresponda.

El restaurante realiza posteriormente la facturación en su software habitual.

### 6.2 Integración manual

Sazora registra la operación y permite almacenar posteriormente:

- Número de factura.
- Fecha de emisión.
- Identificador externo.
- CUFE o identificador aplicable.
- Estado fiscal.
- Archivo PDF.
- Archivo XML.

La factura se genera manualmente en el software fiscal externo.

### 6.3 Integración mediante API

El flujo esperado será:

Sazora registra el pago
→ crea la venta interna
→ solicita la emisión al proveedor
→ el proveedor genera el documento
→ el proveedor transmite o valida el documento
→ Sazora recibe el resultado
→ Sazora almacena los datos fiscales
→ el usuario puede consultar o imprimir el documento

Orden entregada
↓
Registro de pago
↓
Movimiento de caja
↓
Venta interna de Sazora
↓
Solicitud fiscal
↓
Proveedor externo
↓
Validación correspondiente
↓
Número + CUFE + PDF/XML

7. Arquitectura de integración
   La lógica fiscal no deberá acoplarse directamente a un proveedor específico.
   Se utilizará una interfaz interna semejante a:
   interface FiscalProvider {
   issueDocument(
   input: IssueFiscalDocumentInput,
   ): Promise<IssueFiscalDocumentResult>;

getDocumentStatus(
externalId: string,
): Promise<FiscalDocumentStatus>;

downloadPdf(
externalId: string,
): Promise<Buffer>;

downloadXml(
externalId: string,
): Promise<Buffer>;

issueCreditNote(
input: IssueCreditNoteInput,
): Promise<IssueCreditNoteResult>;
}
Cada integración implementará el mismo contrato:
FiscalProvider
├── ProveedorAAdapter
├── ProveedorBAdapter
├── SoftwareContableAdapter
└── ManualFiscalAdapter
Esto permitirá cambiar de proveedor sin modificar el módulo de órdenes, pagos o caja. 8. Módulos que se implementarán
La evolución se dividirá en bloques.
Bloque 1: pagos

- Registrar uno o varios pagos por orden.
- Efectivo.
- Tarjeta.
- Transferencia.
- Otros métodos configurables.
- Pagos combinados.
- Pago total o parcial.
- Estado pendiente, pagado, anulado o reembolsado.
- Referencia externa del pago.
- Usuario que registró el pago.
  Bloque 2: caja
- Apertura de caja.
- Base inicial.
- Asociación del empleado con una caja.
- Entradas y salidas.
- Ventas en efectivo.
- Ventas electrónicas.
- Devoluciones.
- Cierre de caja.
- Efectivo esperado.
- Efectivo declarado.
- Diferencias.
- Historial y auditoría.
  Bloque 3: clientes
- Nombre o razón social.
- Tipo y número de identificación.
- Correo.
- Teléfono.
- Dirección.
- Preferencias de facturación.
- Datos necesarios para el documento fiscal.
  No todos los pedidos deberán exigir cliente. La obligatoriedad dependerá del documento fiscal y de las reglas aplicables.
  Bloque 4: venta interna
  La venta interna será diferente de la orden operativa.
  La orden representa:
- Qué pidió el cliente.
- Qué se preparó.
- Qué se entregó.
  La venta representa:
- Qué se cobró.
- Cuánto se pagó.
- Mediante qué métodos.
- Qué descuentos e impuestos se registraron.
- Si existe o no un documento fiscal asociado.
  Bloque 5: comprobantes internos
- Precuenta.
- Comprobante de pago.
- Reimpresión.
- Numeración interna.
- Plantilla por negocio.
- Leyenda de documento no fiscal.
- Auditoría de impresión.
  Bloque 6: integración fiscal
- Configuración del proveedor.
- Ambiente de pruebas o producción.
- Credenciales cifradas.
- Emisión.
- Consulta de estado.
- Reintentos.
- Webhooks.
- Notas crédito.
- Descarga de PDF y XML.
- Auditoría.
- Manejo de errores y contingencias.

9. Estados fiscales internos
   Sazora podrá registrar estados como:
   type FiscalDocumentStatus =
   | "NOT_REQUIRED"
   | "PENDING"
   | "PROCESSING"
   | "ACCEPTED"
   | "REJECTED"
   | "CONTINGENCY"
   | "CANCELLED";
   Estos estados no reemplazan los estados definidos por la DIAN o el proveedor. Funcionan como una normalización interna.
   También deberán guardarse:
   type FiscalDocumentRecord = {
   id: string;
   businessId: string;
   saleId: string;
   provider: string;
   documentType: string;
   status: FiscalDocumentStatus;
   externalId: string | null;
   documentNumber: string | null;
   cufe: string | null;
   pdfUrl: string | null;
   xmlUrl: string | null;
   requestPayload: unknown;
   responsePayload: unknown;
   errorCode: string | null;
   errorMessage: string | null;
   issuedAt: Date | null;
   validatedAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
   };
   Los datos sensibles y las credenciales no deberán almacenarse dentro de los payloads de auditoría.
10. Transacciones y proveedor externo
    La llamada al proveedor fiscal no deberá ejecutarse dentro de la misma transacción SQL que registra el pago.
    El flujo recomendado será:
11. Registrar el pago.
12. Registrar el movimiento de caja.
13. Crear la venta interna.
14. Crear una solicitud fiscal pendiente.
15. Confirmar la transacción local.
16. Procesar la solicitud fiscal.
17. Actualizar el resultado.
    Esto evita perder el pago si el proveedor externo está temporalmente fuera de servicio.
    Se utilizarán:

- Claves de idempotencia.
- Cola o patrón outbox.
- Reintentos controlados.
- Registro de intentos.
- Webhooks firmados.
- Consulta de estado.
- Prevención de facturas duplicadas.
  La política de contingencia deberá definirse junto con el proveedor fiscal y un asesor tributario.

11. Relación entre orden, pago y factura
    Los conceptos permanecerán separados:
    ORDER
    Operación del restaurante

PAYMENT
Dinero recibido

SALE
Resultado comercial interno

FISCAL_DOCUMENT
Documento emitido mediante el sistema fiscal
Una orden confirmada no significa que esté pagada.
Una orden entregada no significa que esté facturada.
Una orden cerrada deberá tener una regla explícita relacionada con pagos. Esta regla se definirá cuando se implemente el módulo de caja.
Un fallo del proveedor fiscal no deberá borrar:

- La orden.
- Los pagos.
- Los movimientos de caja.
- La venta interna.
  Debe quedar una solicitud fiscal pendiente o rechazada para gestión posterior.

12. Configuración por negocio
    Cada negocio podrá configurar:
    type FiscalIntegrationMode =
    | "NONE"
    | "MANUAL"
    | "PROVIDER_API";
    Configuración futura:

- Modo de integración.
- Proveedor.
- Ambiente.
- Identificador del software.
- Resolución o numeración aplicable.
- Prefijo.
- Credenciales cifradas.
- Plantilla de comprobante interno.
- Impuestos.
- Responsabilidades fiscales.
- Activación de factura automática después del pago.
- Manejo de contingencias.
  La información tributaria no deberá inferirse solamente a partir del tipo de negocio. Será configurada y validada por el responsable del establecimiento.

13. Reglas de seguridad y auditoría
    Se deberá registrar:

- Quién recibió el pago.
- Quién anuló un pago.
- Quién abrió y cerró la caja.
- Quién solicitó la factura.
- Quién reintentó una emisión.
- Quién imprimió o reimprimió un documento.
- Cuándo cambió el estado fiscal.
- Respuesta técnica del proveedor.
  Las credenciales:
- Se almacenarán cifradas.
- No se devolverán al frontend.
- No aparecerán en logs.
- No se incluirán en errores.
- Se rotarán cuando sea necesario.

14. Decisiones que se aplazan
    Esta etapa no se implementará hasta terminar la integración de los módulos actuales del backend con el frontend.
    Quedan aplazados:

- Pagos.
- Caja.
- Turnos.
- Comprobantes internos.
- Clientes fiscales.
- Impuestos definitivos.
- Facturación electrónica.
- Documento equivalente electrónico.
- Selección de proveedor.
- Integración API.
- Notas crédito.
- Contingencias fiscales.
  Antes de implementarlos deberá definirse:

1. El primer proveedor o software fiscal que se integrará.
2. Su documentación API.
3. Sus ambientes de pruebas.
4. El modelo de impuestos.
5. El flujo de pagos y cierres.
6. El tratamiento de anulaciones y devoluciones.
7. Los requisitos revisados por un contador.
8. Las obligaciones particulares de cada restaurante.
9. Referencias oficiales
   La DIAN permite facturar mediante:

- Servicio gratuito.
- Desarrollo propio.
- Proveedor tecnológico habilitado.
  También mantiene un catálogo público de proveedores tecnológicos habilitados.
  La regulación y los anexos técnicos pueden cambiar. Antes de desarrollar la integración deberán revisarse nuevamente las fuentes oficiales vigentes y la situación tributaria del negocio.

16. Advertencia
    Este documento define una arquitectura de software y un alcance funcional futuro.
    No constituye asesoría tributaria, contable o legal.
    La terminología de los comprobantes, los impuestos, la numeración y las obligaciones de cada restaurante deberán ser revisados por un contador o asesor tributario antes de utilizar Sazora en producción.

La decisión está bien planteada: Sazora puede ser el sistema operativo completo del restaurante sin convertirse inicialmente en proveedor tecnológico. La DIAN contempla facturación mediante servicio gratuito, desarrollo propio o proveedor habilitado; por eso una integración por API es una ruta válida, siempre que el documento fiscal sea realmente emitido por el sistema habilitado y el restaurante cumpla sus obligaciones. [Opciones para facturar electrónicamente — DIAN](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/como-puedes-facturar-electronicamente/), [proveedores tecnológicos habilitados — DIAN](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/proveedores-tecnologicos/), [Resolución 000165 de 2023](https://www.dian.gov.co/normatividad/Normatividad/Resoluci%C3%B3n%20000165%20de%2001-11-2023.pdf).

Por ahora esto queda como una decisión futura y no cambia los endpoints actuales de órdenes. El siguiente trabajo continúa siendo completar la integración operativa actual antes de iniciar pagos, caja y facturación.
