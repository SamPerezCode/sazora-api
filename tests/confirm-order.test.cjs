const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const createScenario = ({ failTicket = false } = {}) => {
  const items = [
    {
      id: "10",
      productId: "20",
      quantity: 2,
      preparationAreaId: "1",
      fulfillmentMode: "READY_TO_SERVE",
      preparationAreaIsActive: 1,
      unitPrice: 3240,
    },
    {
      id: "11",
      productId: "21",
      quantity: 1,
      preparationAreaId: "1",
      fulfillmentMode: "READY_TO_SERVE",
      preparationAreaIsActive: 1,
      unitPrice: 2160,
    },
  ];

  let state = {
    status: "OPEN",
    paymentStatus: "VERIFIED",
    deductions: 0,
    reservationsConsumed: false,
    tickets: 0,
    ticketStatuses: [],
  };

  let snapshot;
  let insertId = 100;

  const calls = {
    commits: 0,
    rollbacks: 0,
    releases: 0,
    amountChecks: 0,
  };

  const connection = {
    beginTransaction: async () => {
      snapshot = structuredClone(state);
    },

    commit: async () => {
      calls.commits += 1;
    },

    rollback: async () => {
      state = structuredClone(snapshot);
      calls.rollbacks += 1;
    },

    release: () => {
      calls.releases += 1;
    },

    execute: async (sql, parameters = []) => {
      const query = sql.replace(/\s+/g, " ").trim();

      if (query.startsWith("SELECT status,")) {
        return [
          [
            {
              status: state.status,
              paymentStatus: state.paymentStatus,
              serviceType: "TAKEAWAY",
              locationId: "1",
            },
          ],
        ];
      }

      if (query.includes("FROM order_payment_batches")) {
        return [[{ paidTotal: "8640.00" }]];
      }

      if (query.includes("AS amountsMatch")) {
        calls.amountChecks += 1;

        assert.doesNotMatch(
          query,
          /\bline_total\b/i,
          "La consulta no debe usar una columna inexistente",
        );

        assert.match(query, /quantity\s*\*\s*unit_price/i);

        const total = items.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        );

        return [
          [
            {
              amountsMatch: total === Number(parameters[0]) ? 1 : 0,
            },
          ],
        ];
      }

      if (query.includes("FROM business_locations")) {
        return [[{ workflowMode: "PRINT_AND_SCREEN" }]];
      }

      if (query.includes("FROM order_items AS oi")) {
        return [items];
      }

      if (query.startsWith("INSERT INTO kitchen_tickets ")) {
        if (failTicket) {
          throw new Error("Fallo simulado al crear comanda");
        }

        state.tickets += 1;
      } else if (query.startsWith("INSERT INTO kitchen_ticket_items ")) {
        state.ticketStatuses.push(parameters[5]);
        assert.equal(parameters[7], "READY");
        assert.match(query, /ready_at/);
      } else if (query.startsWith("INSERT INTO kitchen_item_status_history ")) {
        assert.equal(parameters[3], "READY");
      } else if (query.startsWith("UPDATE orders ")) {
        assert.equal(parameters[0], "PRINT_AND_SCREEN");
        state.status = "CONFIRMED";
      } else if (!query.startsWith("INSERT INTO order_status_history ")) {
        throw new Error(`Consulta no contemplada: ${query}`);
      }

      insertId += 1;
      return [{ insertId, affectedRows: 1 }];
    },
  };

  const dependencies = {
    "../../../database/pool": {
      databasePool: {
        getConnection: async () => connection,
      },
    },

    "./deduct-order-inventory.repository": {
      deductOrderInventory: async () => {
        state.deductions += 1;

        return {
          kind: "DEDUCTED",
          movementIds: ["1000", "1001"],
        };
      },
    },

    "../../inventory-reservatios/repositories/inventory-reservation.repository":
      {
        consumeOrderReservations: async () => {
          state.reservationsConsumed = true;
        },
      },

    "../../inventory-reservatios/repositories/order-item-reservation.repository":
      {
        reserveOrderItemInventoryOrThrow: async () => undefined,
      },
  };

  const filename = path.resolve(
    __dirname,
    "../src/modules/orders/repositories/confirm-order.repository.ts",
  );

  const source = readFileSync(filename, "utf8");

  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const moduleRecord = { exports: {} };

  vm.runInNewContext(
    compiled,
    {
      module: moduleRecord,
      exports: moduleRecord.exports,
      require: (name) => {
        if (!Object.hasOwn(dependencies, name)) {
          throw new Error(`Dependencia no simulada: ${name}`);
        }

        return dependencies[name];
      },
    },
    { filename },
  );

  return {
    confirm: moduleRecord.exports.confirmOrder,
    getState: () => state,
    calls,
  };
};

test("confirma productos listos y evita una segunda confirmación", async () => {
  const scenario = createScenario();

  const first = await scenario.confirm("1", "1", "5");

  assert.equal(first.kind, "CONFIRMED");
  assert.equal(first.inventoryChanged, true);
  assert.equal(first.kitchenTickets.length, 1);

  const state = scenario.getState();

  assert.equal(state.status, "CONFIRMED");
  assert.equal(state.paymentStatus, "VERIFIED");
  assert.equal(state.deductions, 1);
  assert.equal(state.reservationsConsumed, true);
  assert.equal(state.tickets, 1);
  assert.deepEqual(state.ticketStatuses, ["READY", "READY"]);
  assert.equal(scenario.calls.amountChecks, 1);
  assert.equal(scenario.calls.commits, 1);

  const second = await scenario.confirm("1", "1", "5");

  assert.equal(second.kind, "ORDER_NOT_OPEN");
  assert.equal(scenario.getState().deductions, 1);
  assert.equal(scenario.getState().tickets, 1);
  assert.equal(scenario.calls.commits, 1);
  assert.equal(scenario.calls.rollbacks, 1);
  assert.equal(scenario.calls.releases, 2);
});

test("revierte la confirmación si falla la creación de comanda", async () => {
  const scenario = createScenario({ failTicket: true });

  await assert.rejects(
    scenario.confirm("1", "1", "5"),
    /Fallo simulado al crear comanda/,
  );

  const state = scenario.getState();

  assert.equal(state.status, "OPEN");
  assert.equal(state.paymentStatus, "VERIFIED");
  assert.equal(state.deductions, 0);
  assert.equal(state.reservationsConsumed, false);
  assert.equal(state.tickets, 0);
  assert.equal(state.ticketStatuses.length, 0);
  assert.equal(scenario.calls.commits, 0);
  assert.equal(scenario.calls.rollbacks, 1);
  assert.equal(scenario.calls.releases, 1);
});
