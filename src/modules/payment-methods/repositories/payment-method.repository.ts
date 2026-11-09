import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  CreatePaymentMethodData,
  PaymentMethod,
  PaymentType,
  UpdatePaymentMethodData,
} from "../payment-method.types";

type PaymentMethodRow = RowDataPacket & {
  id: string;
  businessId: string;
  code: string;
  name: string;
  paymentType: PaymentType;
  requiresReference: number;
  affectsCash: number;
  allowsChange: number;
  displayOrder: number;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

const mapPaymentMethodRow = (row: PaymentMethodRow): PaymentMethod => ({
  id: row.id,
  businessId: row.businessId,
  code: row.code,
  name: row.name,
  paymentType: row.paymentType,
  requiresReference: Boolean(row.requiresReference),
  affectsCash: Boolean(row.affectsCash),
  allowsChange: Boolean(row.allowsChange),
  displayOrder: row.displayOrder,
  isActive: Boolean(row.isActive),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const paymentMethodSelect = `
  SELECT
    CAST(id AS CHAR) AS id,
    CAST(business_id AS CHAR) AS businessId,
    code,
    name,
    payment_type AS paymentType,
    requires_reference AS requiresReference,
    affects_cash AS affectsCash,
    allows_change AS allowsChange,
    display_order AS displayOrder,
    is_active AS isActive,
    created_at AS createdAt,
    updated_at AS updatedAt
  FROM payment_methods
`;

const findPaymentMethods = async (
  businessId: string,
  activeOnly: boolean,
): Promise<PaymentMethod[]> => {
  const [rows] = await databasePool.execute<PaymentMethodRow[]>(
    `
      ${paymentMethodSelect}
      WHERE
        business_id = ?
        ${activeOnly ? "AND is_active = TRUE" : ""}
      ORDER BY
        display_order ASC,
        name ASC,
        id ASC
    `,
    [businessId],
  );

  return rows.map(mapPaymentMethodRow);
};

const findPaymentMethodById = async (
  businessId: string,
  paymentMethodId: string,
): Promise<PaymentMethod | null> => {
  const [rows] = await databasePool.execute<PaymentMethodRow[]>(
    `
      ${paymentMethodSelect}
      WHERE
        business_id = ?
        AND id = ?
      LIMIT 1
    `,
    [businessId, paymentMethodId],
  );

  return rows[0] ? mapPaymentMethodRow(rows[0]) : null;
};

const findPaymentMethodByCode = async (
  businessId: string,
  code: string,
): Promise<PaymentMethod | null> => {
  const [rows] = await databasePool.execute<PaymentMethodRow[]>(
    `
      ${paymentMethodSelect}
      WHERE
        business_id = ?
        AND code = ?
      LIMIT 1
    `,
    [businessId, code],
  );

  return rows[0] ? mapPaymentMethodRow(rows[0]) : null;
};

const insertPaymentMethod = async (
  businessId: string,
  data: CreatePaymentMethodData,
): Promise<PaymentMethod> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      INSERT INTO payment_methods (
        business_id,
        code,
        name,
        payment_type,
        requires_reference,
        affects_cash,
        allows_change,
        display_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      businessId,
      data.code,
      data.name,
      data.paymentType,
      data.requiresReference,
      data.affectsCash,
      data.allowsChange,
      data.displayOrder,
    ],
  );

  const paymentMethod = await findPaymentMethodById(
    businessId,
    result.insertId.toString(),
  );

  if (!paymentMethod) {
    throw new Error("No fue posible recuperar la forma de pago creada");
  }

  return paymentMethod;
};

const updatePaymentMethodById = async (
  businessId: string,
  paymentMethodId: string,
  data: UpdatePaymentMethodData,
): Promise<PaymentMethod | null> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      UPDATE payment_methods
      SET
        code = ?,
        name = ?,
        payment_type = ?,
        requires_reference = ?,
        affects_cash = ?,
        allows_change = ?,
        display_order = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [
      data.code,
      data.name,
      data.paymentType,
      data.requiresReference,
      data.affectsCash,
      data.allowsChange,
      data.displayOrder,
      businessId,
      paymentMethodId,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findPaymentMethodById(businessId, paymentMethodId);
};

const updatePaymentMethodStatusById = async (
  businessId: string,
  paymentMethodId: string,
  isActive: boolean,
): Promise<PaymentMethod | null> => {
  const [result] = await databasePool.execute<ResultSetHeader>(
    `
      UPDATE payment_methods
      SET is_active = ?
      WHERE
        business_id = ?
        AND id = ?
    `,
    [isActive, businessId, paymentMethodId],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return findPaymentMethodById(businessId, paymentMethodId);
};

export {
  findPaymentMethodByCode,
  findPaymentMethodById,
  findPaymentMethods,
  insertPaymentMethod,
  updatePaymentMethodById,
  updatePaymentMethodStatusById,
};
