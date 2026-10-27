import { writeFileSync } from "node:fs";

const successTest = [
  'pm.test("Respuesta exitosa", () => {',
  "  pm.expect(pm.response.code).to.be.within(200, 299);",
  '  pm.expect(pm.response.json().status).to.eql("success");',
  "});",
];

const bearerAuth = (variable) => ({
  type: "bearer",
  bearer: [
    {
      key: "token",
      value: `{{${variable}}}`,
      type: "string",
    },
  ],
});

const jsonRequest = ({
  name,
  method,
  path,
  body,
  token = "accessToken",
  tests = successTest,
  noAuth = false,
}) => ({
  name,

  event:
    tests.length === 0
      ? []
      : [
          {
            listen: "test",
            script: {
              type: "text/javascript",
              exec: tests,
            },
          },
        ],

  request: {
    method,

    header:
      body === undefined
        ? []
        : [
            {
              key: "Content-Type",
              value: "application/json",
            },
          ],

    ...(noAuth
      ? {
          auth: {
            type: "noauth",
          },
        }
      : {
          auth: bearerAuth(token),
        }),

    ...(body === undefined
      ? {}
      : {
          body: {
            mode: "raw",
            raw: JSON.stringify(body, null, 2),
            options: {
              raw: {
                language: "json",
              },
            },
          },
        }),

    url: `{{baseUrl}}/api${path}`,
  },
});

const collection = {
  info: {
    name: "Sazora - Producción valorizada",
    description:
      "Pruebas de recetas, órdenes, aislamiento por planta, desperdicio, valoración, rendimiento e informes.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },

  variable: [
    {
      key: "baseUrl",
      value: "http://localhost:3000/api",
    },

    {
      key: "productionLocationId",
      value: "",
    },
    {
      key: "forbiddenLocationId",
      value: "",
    },
    {
      key: "inputInventoryItemId",
      value: "",
    },
    {
      key: "outputInventoryItemId",
      value: "",
    },
    {
      key: "recipeId",
      value: "",
    },
    {
      key: "productionOrderId",
      value: "",
    },
    {
      key: "orderVersion",
      value: "",
    },
    {
      key: "wasteRecordId",
      value: "",
    },
    {
      key: "reportFrom",
      value: "2026-01-01",
    },
    {
      key: "reportTo",
      value: "2026-12-31",
    },
  ],

  item: [
    {
      name: "02 - Recetas",

      item: [
        jsonRequest({
          name: "Crear receta como ADMIN",
          method: "POST",
          path: "/production-recipes",

          body: {
            code: "PRUEBA-{{$timestamp}}",
            name: "Receta de prueba Postman",
            notes: "Creada durante la prueba integral",

            inputs: [
              {
                inventoryItemId: "{{inputInventoryItemId}}",
                quantity: "1.000",
                notes: null,
              },
            ],

            outputs: [
              {
                inventoryItemId: "{{outputInventoryItemId}}",
                quantity: "1.000",
                costAllocationPercentage: "100.000000",
                notes: null,
              },
            ],
          },

          tests: [
            ...successTest,
            "const json = pm.response.json();",
            'pm.collectionVariables.set("recipeId", json.data.recipe.id);',
          ],
        }),

        jsonRequest({
          name: "Consultar recetas como PRODUCTION",
          method: "GET",
          path: "/production-recipes",
          token: "employeeAccessToken",
        }),

        jsonRequest({
          name: "PRODUCTION no puede crear recetas",
          method: "POST",
          path: "/production-recipes",
          token: "employeeAccessToken",
          body: {
            code: "NO-PERMITIDA",
            name: "No permitida",
            inputs: [
              {
                inventoryItemId: "{{inputInventoryItemId}}",
                quantity: "1.000",
              },
            ],
            outputs: [
              {
                inventoryItemId: "{{outputInventoryItemId}}",
                quantity: "1.000",
                costAllocationPercentage: "100.000000",
              },
            ],
          },

          tests: [
            'pm.test("PRODUCTION recibe 403", () => {',
            "  pm.expect(pm.response.code).to.eql(403);",
            "});",
          ],
        }),
      ],
    },

    {
      name: "03 - Orden de producción",

      item: [
        jsonRequest({
          name: "Crear orden como ADMIN",
          method: "POST",
          path: "/production-orders",

          body: {
            recipeId: "{{recipeId}}",
            locationId: "{{productionLocationId}}",
            batchQuantity: "1.000",
            plannedFor: "2026-12-01T15:00:00.000Z",
            notes: "Orden creada desde prueba Postman",
          },

          tests: [
            ...successTest,
            "const order = pm.response.json().data.productionOrder;",
            'pm.collectionVariables.set("productionOrderId", order.id);',
            'pm.collectionVariables.set("orderVersion", String(order.version));',
            'pm.expect(order.status).to.eql("DRAFT");',
          ],
        }),

        jsonRequest({
          name: "Planificar orden",
          method: "PATCH",
          path: "/production-orders/{{productionOrderId}}/status",

          body: {
            status: "PLANNED",
            cancellationReason: null,
            version: 1,
          },

          tests: [
            ...successTest,
            "const order = pm.response.json().data.productionOrder;",
            'pm.collectionVariables.set("orderVersion", String(order.version));',
            'pm.expect(order.status).to.eql("PLANNED");',
          ],
        }),

        jsonRequest({
          name: "PRODUCTION consulta su orden",
          method: "GET",
          path: "/production-orders/{{productionOrderId}}",
          token: "employeeAccessToken",
          tests: [
            ...successTest,
            "const order = pm.response.json().data.productionOrder;",
            'pm.expect(order.location.id).to.eql(pm.collectionVariables.get("productionLocationId"));',
          ],
        }),

        jsonRequest({
          name: "Aislamiento - consultar otra planta",
          method: "GET",
          path: "/production-orders?locationId={{forbiddenLocationId}}",
          token: "employeeAccessToken",
          tests: [
            'pm.test("No permite consultar otra planta", () => {',
            "  pm.expect(pm.response.code).to.eql(403);",
            "  const json = pm.response.json();",
            '  pm.expect(json.code).to.eql("LOCATION_ACCESS_DENIED");',
            "});",
          ],
        }),

        jsonRequest({
          name: "Iniciar orden como PRODUCTION",
          method: "POST",
          path: "/production-orders/{{productionOrderId}}/start",
          token: "employeeAccessToken",
          body: {
            version: 2,
          },

          tests: [
            ...successTest,
            "const order = pm.response.json().data.productionOrder;",
            'pm.collectionVariables.set("orderVersion", String(order.version));',
            'pm.expect(order.status).to.eql("IN_PROGRESS");',
          ],
        }),
      ],
    },

    {
      name: "04 - Ejecución y controles",

      item: [
        jsonRequest({
          name: "Stock insuficiente",
          method: "POST",
          path: "/production-orders/{{productionOrderId}}/complete",
          token: "employeeAccessToken",
          body: {
            version: 3,

            inputs: [
              {
                inventoryItemId: "{{inputInventoryItemId}}",
                quantity: "999999999.000",
              },
            ],

            outputs: [
              {
                inventoryItemId: "{{outputInventoryItemId}}",
                quantity: "1.000",
              },
            ],
          },

          tests: [
            'pm.test("Rechaza stock insuficiente", () => {',
            "  pm.expect(pm.response.code).to.eql(409);",
            "  const json = pm.response.json();",
            '  pm.expect(json.code).to.eql("INSUFFICIENT_PRODUCTION_STOCK");',
            "});",
          ],
        }),

        jsonRequest({
          name: "Registrar desperdicio explícito",
          method: "POST",
          path: "/production-orders/{{productionOrderId}}/waste",
          token: "employeeAccessToken",
          body: {
            version: 3,
            reason: "Pérdida controlada durante prueba",

            lines: [
              {
                inventoryItemId: "{{inputInventoryItemId}}",
                quantity: "0.001",
                notes: "Prueba de auditoría",
              },
            ],
          },

          tests: [
            ...successTest,
            "const data = pm.response.json().data;",
            'pm.collectionVariables.set("wasteRecordId", data.wasteRecord.id);',
            'pm.collectionVariables.set("orderVersion", String(data.productionOrder.version));',
          ],
        }),

        jsonRequest({
          name: "Completar orden",
          method: "POST",
          path: "/production-orders/{{productionOrderId}}/complete",
          token: "employeeAccessToken",
          body: {
            version: 4,

            inputs: [
              {
                inventoryItemId: "{{inputInventoryItemId}}",
                quantity: "1.000",
              },
            ],

            outputs: [
              {
                inventoryItemId: "{{outputInventoryItemId}}",
                quantity: "1.000",
              },
            ],
          },

          tests: [
            ...successTest,
            "const order = pm.response.json().data.productionOrder;",
            'pm.collectionVariables.set("orderVersion", String(order.version));',
            'pm.expect(order.status).to.eql("COMPLETED");',
            "pm.expect(order.inventoryMovementId).to.not.eql(null);",
          ],
        }),

        jsonRequest({
          name: "Impedir doble finalización",
          method: "POST",
          path: "/production-orders/{{productionOrderId}}/complete",
          token: "employeeAccessToken",
          body: {
            version: 5,

            inputs: [
              {
                inventoryItemId: "{{inputInventoryItemId}}",
                quantity: "1.000",
              },
            ],

            outputs: [
              {
                inventoryItemId: "{{outputInventoryItemId}}",
                quantity: "1.000",
              },
            ],
          },

          tests: [
            'pm.test("No permite finalizar dos veces", () => {',
            "  pm.expect(pm.response.code).to.eql(409);",
            "  const json = pm.response.json();",
            '  pm.expect(json.code).to.eql("PRODUCTION_ORDER_NOT_IN_PROGRESS");',
            "});",
          ],
        }),

        jsonRequest({
          name: "Consultar desperdicios",
          method: "GET",
          path: "/production-orders/{{productionOrderId}}/waste",
          token: "employeeAccessToken",
        }),

        jsonRequest({
          name: "Consultar rendimiento",
          method: "GET",
          path: "/production-orders/{{productionOrderId}}/performance",
          token: "employeeAccessToken",
          tests: [
            ...successTest,
            "const performance = pm.response.json().data.performance;",
            'pm.expect(performance.status).to.eql("COMPLETED");',
            'pm.expect(performance.inputs).to.be.an("array");',
            'pm.expect(performance.outputs).to.be.an("array");',
          ],
        }),
      ],
    },

    {
      name: "05 - Informes",

      item: [
        jsonRequest({
          name: "Historial de producción",
          method: "GET",
          path: "/production-reports/orders?from={{reportFrom}}&to={{reportTo}}&dateField=CREATED&page=1&pageSize=20",
        }),

        jsonRequest({
          name: "Resumen de producción",
          method: "GET",
          path: "/production-reports/summary?from={{reportFrom}}&to={{reportTo}}&dateField=CREATED",
        }),

        jsonRequest({
          name: "Agrupar por planta",
          method: "GET",
          path: "/production-reports/groups?from={{reportFrom}}&to={{reportTo}}&dateField=CREATED&groupBy=LOCATION",
        }),

        jsonRequest({
          name: "Agrupar por producto",
          method: "GET",
          path: "/production-reports/groups?from={{reportFrom}}&to={{reportTo}}&dateField=CREATED&groupBy=OUTPUT",
        }),

        jsonRequest({
          name: "Agrupar por empleado",
          method: "GET",
          path: "/production-reports/groups?from={{reportFrom}}&to={{reportTo}}&dateField=CREATED&groupBy=EMPLOYEE",
        }),

        jsonRequest({
          name: "PRODUCTION solo ve sus plantas",
          method: "GET",
          path: "/production-reports/orders?from={{reportFrom}}&to={{reportTo}}&dateField=CREATED&page=1&pageSize=100",
          token: "employeeAccessToken",
          tests: [
            ...successTest,
            "const orders = pm.response.json().data.report.orders;",
            'const allowedLocationId = pm.collectionVariables.get("productionLocationId");',
            "pm.expect(orders.every((order) => order.location.id === allowedLocationId)).to.eql(true);",
          ],
        }),
      ],
    },
  ],
};

const target = new URL(
  "./Sazora-Production.postman_collection.json",
  import.meta.url,
);

writeFileSync(target, `${JSON.stringify(collection, null, 2)}\n`, "utf8");

console.log(
  "Colección creada en docs/postman/Sazora-Production.postman_collection.json",
);
