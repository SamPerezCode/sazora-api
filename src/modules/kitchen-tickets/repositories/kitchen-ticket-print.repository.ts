import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderServiceType, OrderStatus } from "../../orders/order.types";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type {
  KitchenTicketPrint,
  KitchenTicketPrintSnapshot,
  KitchenTicketPrintType,
} from "../kitchen-ticket-print.types";
import type { KitchenPreparationStatus } from "../kitchen-ticket.types";
import type {
  CreateKitchenTicketPrintInput,
  ReprintKitchenTicketInput,
} from "../schemas/kitchen-ticket-print.schema";

type KitchenTicketSnapshotRow = RowDataPacket & {
  businessId: string;
  businessName: string;
  kitchenTicketFooter: string | null;
  kitchenTicketId: string;
  orderId: string;
  preparationAreaId: string;
  preparationAreaName: string;
  ticketVersion: number;
  serviceType: OrderServiceType;
  orderStatus: OrderStatus;
  restaurantTableCode: string | null;
  restaurantTableName: string | null;
  orderNotes: string | null;
  kitchenTicketItemId: string;
  orderItemId: string;
  productName: string;
  fulfillmentMode: ProductFulfillmentMode;
  quantity: number;
  itemNotes: string | null;
  preparationStatus: KitchenPreparationStatus;
};

type ExistingPrintRow = RowDataPacket & {
  id: string;
};

type KitchenTicketPrintRow = RowDataPacket & {
  id: string;
  businessId: string;
  kitchenTicketId: string;
  printedByMembershipId: string;
  ticketVersion: number;
  printType: KitchenTicketPrintType;
  reason: string | null;
  printerName: string | null;
  contentSnapshot: unknown;
  createdAt: Date;
};

type TicketExistsRow = RowDataPacket & {
  found: number;
};

type CreateKitchenTicketPrintResult =
  | Readonly<{
      kind: "CREATED";
      print: KitchenTicketPrint;
    }>
  | Readonly<{
      kind: "TICKET_NOT_FOUND";
    }>
  | Readonly<{
      kind: "ORDER_NOT_CONFIRMED";
    }>
  | Readonly<{
      kind: "REASON_REQUIRED";
    }>
  | Readonly<{
      kind: "VERSION_ALREADY_PRINTED";
    }>;

type ListKitchenTicketPrintsResult =
  | Readonly<{
      kind: "FOUND";
      prints: readonly KitchenTicketPrint[];
    }>
  | Readonly<{
      kind: "TICKET_NOT_FOUND";
    }>;

type ReprintKitchenTicketResult =
  | Readonly<{
      kind: "CREATED";
      print: KitchenTicketPrint;
    }>
  | Readonly<{
      kind: "PRINT_NOT_FOUND";
    }>;

const parseContentSnapshot = (value: unknown): KitchenTicketPrintSnapshot => {
  if (typeof value === "string") {
    const parsed: unknown = JSON.parse(value);

    return parsed as KitchenTicketPrintSnapshot;
  }

  return value as KitchenTicketPrintSnapshot;
};

const mapKitchenTicketPrintRow = (
  row: KitchenTicketPrintRow,
): KitchenTicketPrint => ({
  id: row.id,
  businessId: row.businessId,
  kitchenTicketId: row.kitchenTicketId,
  printedByMembershipId: row.printedByMembershipId,
  ticketVersion: row.ticketVersion,
  printType: row.printType,
  reason: row.reason,
  printerName: row.printerName,
  contentSnapshot: parseContentSnapshot(row.contentSnapshot),
  createdAt: row.createdAt,
});

const buildContentSnapshot = (
  rows: readonly KitchenTicketSnapshotRow[],
  generatedAt: Date,
): KitchenTicketPrintSnapshot => {
  const ticket = rows[0];

  if (!ticket) {
    throw new Error("No fue posible construir la copia de la comanda");
  }

  return {
    businessId: ticket.businessId,
    businessName: ticket.businessName,
    kitchenTicketFooter: ticket.kitchenTicketFooter,
    kitchenTicketId: ticket.kitchenTicketId,
    orderId: ticket.orderId,
    preparationAreaId: ticket.preparationAreaId,
    preparationAreaName: ticket.preparationAreaName,
    ticketVersion: ticket.ticketVersion,
    serviceType: ticket.serviceType,
    restaurantTableCode: ticket.restaurantTableCode,
    restaurantTableName: ticket.restaurantTableName,
    orderNotes: ticket.orderNotes,
    generatedAt: generatedAt.toISOString(),
    items: rows.map((row) => ({
      kitchenTicketItemId: row.kitchenTicketItemId,
      orderItemId: row.orderItemId,
      productName: row.productName,
      fulfillmentMode: row.fulfillmentMode,
      quantity: row.quantity,
      notes: row.itemNotes,
      preparationStatus: row.preparationStatus,
    })),
  };
};

const createKitchenTicketPrint = async (
  businessId: string,
  membershipId: string,
  kitchenTicketId: string,
  input: CreateKitchenTicketPrintInput,
): Promise<CreateKitchenTicketPrintResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [snapshotRows] = await connection.execute<KitchenTicketSnapshotRow[]>(
      `
    SELECT
      CAST(kt.business_id AS CHAR) AS businessId,
      b.name AS businessName,
      bs.kitchen_ticket_footer AS kitchenTicketFooter,
      CAST(kt.id AS CHAR) AS kitchenTicketId,
      CAST(kt.order_id AS CHAR) AS orderId,
      CAST(kt.preparation_area_id AS CHAR) AS preparationAreaId,
      pa.name AS preparationAreaName,
      kt.current_version AS ticketVersion,
      o.service_type AS serviceType,
      o.status AS orderStatus,
      rt.code AS restaurantTableCode,
      rt.name AS restaurantTableName,
      o.notes AS orderNotes,
      CAST(kti.id AS CHAR) AS kitchenTicketItemId,
      CAST(kti.order_item_id AS CHAR) AS orderItemId,
      oi.product_name AS productName,
      oi.fulfillment_mode AS fulfillmentMode,
      oi.quantity,
      oi.notes AS itemNotes,
      kti.preparation_status AS preparationStatus
    FROM kitchen_tickets AS kt
    INNER JOIN businesses AS b
      ON b.id = kt.business_id
    INNER JOIN business_settings AS bs
      ON bs.business_id = kt.business_id
    INNER JOIN orders AS o
      ON o.business_id = kt.business_id
      AND o.id = kt.order_id
    INNER JOIN preparation_areas AS pa
      ON pa.business_id = kt.business_id
      AND pa.id = kt.preparation_area_id
    LEFT JOIN restaurant_tables AS rt
      ON rt.business_id = o.business_id
      AND rt.id = o.restaurant_table_id
    INNER JOIN kitchen_ticket_items AS kti
      ON kti.business_id = kt.business_id
      AND kti.kitchen_ticket_id = kt.id
    INNER JOIN order_items AS oi
      ON oi.business_id = kti.business_id
      AND oi.id = kti.order_item_id
    WHERE
      kt.business_id = ?
      AND kt.id = ?
    ORDER BY
      kti.created_at ASC,
      kti.id ASC
    FOR UPDATE
  `,
      [businessId, kitchenTicketId],
    );

    const ticket = snapshotRows[0];

    if (!ticket) {
      await connection.rollback();

      return {
        kind: "TICKET_NOT_FOUND",
      };
    }

    if (ticket.orderStatus !== "CONFIRMED") {
      await connection.rollback();

      return {
        kind: "ORDER_NOT_CONFIRMED",
      };
    }

    const [existingPrintRows] = await connection.execute<ExistingPrintRow[]>(
      `
        SELECT CAST(id AS CHAR) AS id
        FROM kitchen_ticket_prints
        WHERE
          business_id = ?
          AND kitchen_ticket_id = ?
          AND ticket_version = ?
          AND print_type IN ('INITIAL', 'MODIFICATION')
        LIMIT 1
      `,
      [businessId, kitchenTicketId, ticket.ticketVersion],
    );

    if (existingPrintRows[0]) {
      await connection.rollback();

      return {
        kind: "VERSION_ALREADY_PRINTED",
      };
    }

    const printType: KitchenTicketPrintType =
      ticket.ticketVersion === 1 ? "INITIAL" : "MODIFICATION";

    if (printType === "MODIFICATION" && input.reason === null) {
      await connection.rollback();

      return {
        kind: "REASON_REQUIRED",
      };
    }

    const createdAt = new Date();
    const reason = printType === "INITIAL" ? null : input.reason;
    const contentSnapshot = buildContentSnapshot(snapshotRows, createdAt);

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO kitchen_ticket_prints (
          business_id,
          kitchen_ticket_id,
          printed_by_membership_id,
          ticket_version,
          print_type,
          reason,
          printer_name,
          content_snapshot,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        businessId,
        kitchenTicketId,
        membershipId,
        ticket.ticketVersion,
        printType,
        reason,
        input.printerName,
        JSON.stringify(contentSnapshot),
        createdAt,
      ],
    );

    await connection.commit();

    return {
      kind: "CREATED",
      print: {
        id: String(insertResult.insertId),
        businessId,
        kitchenTicketId,
        printedByMembershipId: membershipId,
        ticketVersion: ticket.ticketVersion,
        printType,
        reason,
        printerName: input.printerName,
        contentSnapshot,
        createdAt,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const listKitchenTicketPrints = async (
  businessId: string,
  kitchenTicketId: string,
): Promise<ListKitchenTicketPrintsResult> => {
  const [ticketRows] = await databasePool.execute<TicketExistsRow[]>(
    `
      SELECT 1 AS found
      FROM kitchen_tickets
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, kitchenTicketId],
  );

  if (!ticketRows[0]) {
    return {
      kind: "TICKET_NOT_FOUND",
    };
  }

  const [printRows] = await databasePool.execute<KitchenTicketPrintRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        CAST(business_id AS CHAR) AS businessId,
        CAST(kitchen_ticket_id AS CHAR) AS kitchenTicketId,
        CAST(printed_by_membership_id AS CHAR)
          AS printedByMembershipId,
        ticket_version AS ticketVersion,
        print_type AS printType,
        reason,
        printer_name AS printerName,
        content_snapshot AS contentSnapshot,
        created_at AS createdAt
      FROM kitchen_ticket_prints
      WHERE
        business_id = ?
        AND kitchen_ticket_id = ?
      ORDER BY
        created_at DESC,
        id DESC
    `,
    [businessId, kitchenTicketId],
  );

  return {
    kind: "FOUND",
    prints: printRows.map(mapKitchenTicketPrintRow),
  };
};

const reprintKitchenTicket = async (
  businessId: string,
  membershipId: string,
  kitchenTicketId: string,
  kitchenTicketPrintId: string,
  input: ReprintKitchenTicketInput,
): Promise<ReprintKitchenTicketResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [sourcePrintRows] = await connection.execute<KitchenTicketPrintRow[]>(
      `
        SELECT
          CAST(id AS CHAR) AS id,
          CAST(business_id AS CHAR) AS businessId,
          CAST(kitchen_ticket_id AS CHAR) AS kitchenTicketId,
          CAST(printed_by_membership_id AS CHAR)
            AS printedByMembershipId,
          ticket_version AS ticketVersion,
          print_type AS printType,
          reason,
          printer_name AS printerName,
          content_snapshot AS contentSnapshot,
          created_at AS createdAt
        FROM kitchen_ticket_prints
        WHERE
          business_id = ?
          AND kitchen_ticket_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, kitchenTicketId, kitchenTicketPrintId],
    );

    const sourcePrintRow = sourcePrintRows[0];

    if (!sourcePrintRow) {
      await connection.rollback();

      return {
        kind: "PRINT_NOT_FOUND",
      };
    }

    const contentSnapshot = parseContentSnapshot(
      sourcePrintRow.contentSnapshot,
    );

    const createdAt = new Date();

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO kitchen_ticket_prints (
          business_id,
          kitchen_ticket_id,
          printed_by_membership_id,
          ticket_version,
          print_type,
          reason,
          printer_name,
          content_snapshot,
          created_at
        )
        VALUES (?, ?, ?, ?, 'REPRINT', ?, ?, ?, ?)
      `,
      [
        businessId,
        kitchenTicketId,
        membershipId,
        sourcePrintRow.ticketVersion,
        input.reason,
        input.printerName,
        JSON.stringify(contentSnapshot),
        createdAt,
      ],
    );

    await connection.commit();

    return {
      kind: "CREATED",
      print: {
        id: String(insertResult.insertId),
        businessId,
        kitchenTicketId,
        printedByMembershipId: membershipId,
        ticketVersion: sourcePrintRow.ticketVersion,
        printType: "REPRINT",
        reason: input.reason,
        printerName: input.printerName,
        contentSnapshot,
        createdAt,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  createKitchenTicketPrint,
  listKitchenTicketPrints,
  reprintKitchenTicket,
};

export type {
  CreateKitchenTicketPrintResult,
  ListKitchenTicketPrintsResult,
  ReprintKitchenTicketResult,
};
