import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { LocationType } from "../../locations/location.types";
import type {
  CashSession,
  CashSessionFilters,
  OpenCashSessionData,
} from "../cash-session.types";

type CashSessionRow = RowDataPacket & {
  id: string;
  businessId: string;
  cashRegisterId: string;
  openedByMembershipId: string;
  closedByMembershipId: string | null;
  openedByName: string;
  closedByName: string | null;
  status: "OPEN" | "CLOSED";
  currencyCode: string;
  openingCashAmount: string;
  expectedCashAmount: string | null;
  countedCashAmount: string | null;
  differenceAmount: string | null;
  openingNotes: string | null;
  closingNotes: string | null;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cashRegisterCode: string;
  cashRegisterName: string;
  cashRegisterIsActive: number;
  cashRegisterCreatedAt: Date;
  cashRegisterUpdatedAt: Date;
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: LocationType;
  locationIsSalesLocation: number;
  locationIsActive: number;
};

type CashRegisterStateRow = RowDataPacket & {
  id: string;
  locationId: string;
  cashRegisterIsActive: number;
  locationIsActive: number;
  locationIsSalesLocation: number;
};

type BusinessCurrencyRow = RowDataPacket & {
  currencyCode: string;
};

type OpenSessionRow = RowDataPacket & {
  id: string;
};

type OpenCashSessionResult =
  | Readonly<{
      kind: "OPENED";
      cashSession: CashSession;
    }>
  | Readonly<{
      kind: "CASH_REGISTER_NOT_FOUND";
    }>
  | Readonly<{
      kind: "CASH_REGISTER_INACTIVE";
    }>
  | Readonly<{
      kind: "LOCATION_NOT_AVAILABLE";
    }>
  | Readonly<{
      kind: "LOCATION_NOT_SALES_ENABLED";
    }>
  | Readonly<{
      kind: "CASH_SESSION_ALREADY_OPEN";
    }>;

const mapCashSessionRow = (row: CashSessionRow): CashSession => ({
  id: row.id,
  businessId: row.businessId,
  cashRegisterId: row.cashRegisterId,
  openedByMembershipId: row.openedByMembershipId,
  closedByMembershipId: row.closedByMembershipId,
  openedBy: {
    membershipId: row.openedByMembershipId,
    fullName: row.openedByName,
  },
  closedBy:
    row.closedByMembershipId === null || row.closedByName === null
      ? null
      : {
          membershipId: row.closedByMembershipId,
          fullName: row.closedByName,
        },
  status: row.status,
  currencyCode: row.currencyCode,
  openingCashAmount: row.openingCashAmount,
  expectedCashAmount: row.expectedCashAmount,
  countedCashAmount: row.countedCashAmount,
  differenceAmount: row.differenceAmount,
  openingNotes: row.openingNotes,
  closingNotes: row.closingNotes,
  openedAt: row.openedAt,
  closedAt: row.closedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  cashRegister: {
    id: row.cashRegisterId,
    businessId: row.businessId,
    locationId: row.locationId,
    code: row.cashRegisterCode,
    name: row.cashRegisterName,
    isActive: Boolean(row.cashRegisterIsActive),
    createdAt: row.cashRegisterCreatedAt,
    updatedAt: row.cashRegisterUpdatedAt,
    location: {
      id: row.locationId,
      code: row.locationCode,
      name: row.locationName,
      locationType: row.locationType,
      isSalesLocation: Boolean(row.locationIsSalesLocation),
      isActive: Boolean(row.locationIsActive),
    },
  },
});

const cashSessionSelect = `
  SELECT
    CAST(cs.id AS CHAR) AS id,
    CAST(cs.business_id AS CHAR) AS businessId,
    CAST(cs.cash_register_id AS CHAR) AS cashRegisterId,
    CAST(cs.opened_by_membership_id AS CHAR)
      AS openedByMembershipId,
    CAST(cs.closed_by_membership_id AS CHAR)
      AS closedByMembershipId,
    opened_user.full_name AS openedByName,
    closed_user.full_name AS closedByName,
    cs.status,
    cs.currency_code AS currencyCode,
    CAST(cs.opening_cash_amount AS CHAR)
      AS openingCashAmount,
    CAST(cs.expected_cash_amount AS CHAR)
      AS expectedCashAmount,
    CAST(cs.counted_cash_amount AS CHAR)
      AS countedCashAmount,
    CAST(cs.difference_amount AS CHAR)
      AS differenceAmount,
    cs.opening_notes AS openingNotes,
    cs.closing_notes AS closingNotes,
    cs.opened_at AS openedAt,
    cs.closed_at AS closedAt,
    cs.created_at AS createdAt,
    cs.updated_at AS updatedAt,
    cr.code AS cashRegisterCode,
    cr.name AS cashRegisterName,
    cr.is_active AS cashRegisterIsActive,
    cr.created_at AS cashRegisterCreatedAt,
    cr.updated_at AS cashRegisterUpdatedAt,
    CAST(cr.location_id AS CHAR) AS locationId,
    bl.code AS locationCode,
    bl.name AS locationName,
    bl.location_type AS locationType,
    bl.is_sales_location AS locationIsSalesLocation,
    bl.is_active AS locationIsActive
  FROM cash_sessions AS cs
  INNER JOIN business_memberships AS opened_membership
    ON opened_membership.business_id = cs.business_id
    AND opened_membership.id = cs.opened_by_membership_id
  INNER JOIN users AS opened_user
    ON opened_user.id = opened_membership.user_id
  LEFT JOIN business_memberships AS closed_membership
    ON closed_membership.business_id = cs.business_id
    AND closed_membership.id = cs.closed_by_membership_id
  LEFT JOIN users AS closed_user
    ON closed_user.id = closed_membership.user_id
  INNER JOIN cash_registers AS cr
    ON cr.business_id = cs.business_id
  AND cr.id = cs.cash_register_id
  INNER JOIN business_locations AS bl
    ON bl.business_id = cr.business_id
    AND bl.id = cr.location_id
`;

const findCashSessionByIdWithConnection = async (
  connection: PoolConnection,
  businessId: string,
  cashSessionId: string,
): Promise<CashSession | null> => {
  const [rows] = await connection.execute<CashSessionRow[]>(
    `
      ${cashSessionSelect}
      WHERE
        cs.business_id = ?
        AND cs.id = ?
      LIMIT 1
    `,
    [businessId, cashSessionId],
  );

  return rows[0] ? mapCashSessionRow(rows[0]) : null;
};

const findCashSessionById = async (
  businessId: string,
  cashSessionId: string,
): Promise<CashSession | null> => {
  const [rows] = await databasePool.execute<CashSessionRow[]>(
    `
      ${cashSessionSelect}
      WHERE
        cs.business_id = ?
        AND cs.id = ?
      LIMIT 1
    `,
    [businessId, cashSessionId],
  );

  return rows[0] ? mapCashSessionRow(rows[0]) : null;
};

const findCashSessions = async (
  businessId: string,
  filters: CashSessionFilters,
): Promise<CashSession[]> => {
  const conditions = ["cs.business_id = ?"];
  const parameters: string[] = [businessId];

  if (filters.locationId !== undefined) {
    conditions.push("cr.location_id = ?");
    parameters.push(filters.locationId);
  }

  if (filters.cashRegisterId !== undefined) {
    conditions.push("cs.cash_register_id = ?");
    parameters.push(filters.cashRegisterId);
  }

  if (filters.status !== undefined) {
    conditions.push("cs.status = ?");
    parameters.push(filters.status);
  }

  const [rows] = await databasePool.execute<CashSessionRow[]>(
    `
      ${cashSessionSelect}
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        cs.opened_at DESC,
        cs.id DESC
    `,
    parameters,
  );

  return rows.map(mapCashSessionRow);
};

const openCashSession = async (
  businessId: string,
  data: OpenCashSessionData,
): Promise<OpenCashSessionResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [cashRegisterRows] = await connection.execute<CashRegisterStateRow[]>(
      `
          SELECT
            CAST(cr.id AS CHAR) AS id,
            CAST(cr.location_id AS CHAR) AS locationId,
            cr.is_active AS cashRegisterIsActive,
            bl.is_active AS locationIsActive,
            bl.is_sales_location AS locationIsSalesLocation
          FROM cash_registers AS cr
          INNER JOIN business_locations AS bl
            ON bl.business_id = cr.business_id
            AND bl.id = cr.location_id
          WHERE
            cr.business_id = ?
            AND cr.id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, data.cashRegisterId],
    );

    const cashRegister = cashRegisterRows[0];

    if (!cashRegister) {
      await connection.rollback();

      return {
        kind: "CASH_REGISTER_NOT_FOUND",
      };
    }

    if (!cashRegister.cashRegisterIsActive) {
      await connection.rollback();

      return {
        kind: "CASH_REGISTER_INACTIVE",
      };
    }

    if (!cashRegister.locationIsActive) {
      await connection.rollback();

      return {
        kind: "LOCATION_NOT_AVAILABLE",
      };
    }

    if (!cashRegister.locationIsSalesLocation) {
      await connection.rollback();

      return {
        kind: "LOCATION_NOT_SALES_ENABLED",
      };
    }

    const [openSessionRows] = await connection.execute<OpenSessionRow[]>(
      `
        SELECT CAST(id AS CHAR) AS id
        FROM cash_sessions
        WHERE
          business_id = ?
          AND cash_register_id = ?
          AND status = 'OPEN'
        LIMIT 1
      `,
      [businessId, data.cashRegisterId],
    );

    if (openSessionRows[0]) {
      await connection.rollback();

      return {
        kind: "CASH_SESSION_ALREADY_OPEN",
      };
    }

    const [businessRows] = await connection.execute<BusinessCurrencyRow[]>(
      `
        SELECT currency_code AS currencyCode
        FROM businesses
        WHERE id = ?
        LIMIT 1
      `,
      [businessId],
    );

    const business = businessRows[0];

    if (!business) {
      throw new Error("No fue posible recuperar la moneda del negocio");
    }

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO cash_sessions (
          business_id,
          cash_register_id,
          opened_by_membership_id,
          status,
          currency_code,
          opening_cash_amount,
          opening_notes
        )
        VALUES (?, ?, ?, 'OPEN', ?, ?, ?)
      `,
      [
        businessId,
        data.cashRegisterId,
        data.openedByMembershipId,
        business.currencyCode,
        data.openingCashAmount,
        data.openingNotes,
      ],
    );

    const cashSession = await findCashSessionByIdWithConnection(
      connection,
      businessId,
      result.insertId.toString(),
    );

    if (!cashSession) {
      throw new Error("No fue posible recuperar el turno de caja abierto");
    }

    await connection.commit();

    return {
      kind: "OPENED",
      cashSession,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { findCashSessionById, findCashSessions, openCashSession };
export type { OpenCashSessionResult };
