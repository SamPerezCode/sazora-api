import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { PaymentType } from "../../payment-methods/payment-method.types";
import type {
  SaleRefund,
  SaleRefundItem,
  SaleRefundKind,
  SaleRefundPayment,
} from "../sale-refund.types";

interface SaleRefundRow extends RowDataPacket {
  id: string;
  businessId: string;
  saleId: string;
  cashSessionId: string;
  processedByMembershipId: string;
  processedByName: string;
  refundKind: SaleRefundKind;
  reason: string;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  costAmount: string | null;
  refundedAt: Date;
  createdAt: Date;
}

interface SaleRefundItemRow extends RowDataPacket {
  id: string;
  businessId: string;
  refundId: string;
  saleItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  restoreInventory: number;
  inventoryMovementId: string | null;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  costAmount: string | null;
  createdAt: Date;
}

interface SaleRefundPaymentRow extends RowDataPacket {
  id: string;
  businessId: string;
  refundId: string;
  salePaymentId: string;
  processedByMembershipId: string;
  processedByName: string;
  cashMovementId: string | null;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: PaymentType;
  requiresReference: number;
  affectsCash: number;
  amount: string;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
}

const mapSaleRefundItemRow = (row: SaleRefundItemRow): SaleRefundItem => ({
  id: row.id,
  businessId: row.businessId,
  refundId: row.refundId,
  saleItemId: row.saleItemId,
  productId: row.productId,
  productName: row.productName,
  quantity: row.quantity,
  restoreInventory: Boolean(row.restoreInventory),
  inventoryMovementId: row.inventoryMovementId,
  netAmount: row.netAmount,
  taxAmount: row.taxAmount,
  totalAmount: row.totalAmount,
  costAmount: row.costAmount,
  createdAt: row.createdAt,
});

const mapSaleRefundPaymentRow = (
  row: SaleRefundPaymentRow,
): SaleRefundPayment => ({
  id: row.id,
  businessId: row.businessId,
  refundId: row.refundId,
  salePaymentId: row.salePaymentId,
  processedByMembershipId: row.processedByMembershipId,
  processedBy: {
    membershipId: row.processedByMembershipId,
    fullName: row.processedByName,
  },
  cashMovementId: row.cashMovementId,
  paymentMethodCode: row.paymentMethodCode,
  paymentMethodName: row.paymentMethodName,
  paymentType: row.paymentType,
  requiresReference: Boolean(row.requiresReference),
  affectsCash: Boolean(row.affectsCash),
  amount: row.amount,
  reference: row.reference,
  notes: row.notes,
  createdAt: row.createdAt,
});

const mapSaleRefundRow = (
  row: SaleRefundRow,
  items: SaleRefundItem[],
  payments: SaleRefundPayment[],
): SaleRefund => ({
  id: row.id,
  businessId: row.businessId,
  saleId: row.saleId,
  cashSessionId: row.cashSessionId,
  processedByMembershipId: row.processedByMembershipId,
  processedBy: {
    membershipId: row.processedByMembershipId,
    fullName: row.processedByName,
  },
  refundKind: row.refundKind,
  reason: row.reason,
  netAmount: row.netAmount,
  taxAmount: row.taxAmount,
  totalAmount: row.totalAmount,
  costAmount: row.costAmount,
  refundedAt: row.refundedAt,
  createdAt: row.createdAt,
  items,
  payments,
});

const findSaleRefunds = async (
  businessId: string,
  saleId: string,
): Promise<SaleRefund[]> => {
  const [refundResult, itemResult, paymentResult] = await Promise.all([
    databasePool.execute<SaleRefundRow[]>(
      `
        SELECT
          CAST(sr.id AS CHAR) AS id,
          CAST(sr.business_id AS CHAR) AS businessId,
          CAST(sr.sale_id AS CHAR) AS saleId,
          CAST(sr.cash_session_id AS CHAR) AS cashSessionId,
          CAST(sr.processed_by_membership_id AS CHAR)
            AS processedByMembershipId,
          processed_user.full_name AS processedByName,
          sr.refund_kind AS refundKind,
          sr.reason,
          CAST(sr.net_amount AS CHAR) AS netAmount,
          CAST(sr.tax_amount AS CHAR) AS taxAmount,
          CAST(sr.total_amount AS CHAR) AS totalAmount,
          CAST(sr.cost_amount AS CHAR) AS costAmount,
          sr.refunded_at AS refundedAt,
          sr.created_at AS createdAt
        FROM sale_refunds AS sr
        INNER JOIN business_memberships AS processed_membership
          ON processed_membership.business_id = sr.business_id
          AND processed_membership.id = sr.processed_by_membership_id
        INNER JOIN users AS processed_user
          ON processed_user.id = processed_membership.user_id
        WHERE
          sr.business_id = ?
          AND sr.sale_id = ?
        ORDER BY
          sr.refunded_at DESC,
          sr.id DESC
      `,
      [businessId, saleId],
    ),

    databasePool.execute<SaleRefundItemRow[]>(
      `
        SELECT
          CAST(sri.id AS CHAR) AS id,
          CAST(sri.business_id AS CHAR) AS businessId,
          CAST(sri.refund_id AS CHAR) AS refundId,
          CAST(sri.sale_item_id AS CHAR) AS saleItemId,
          CAST(sri.product_id AS CHAR) AS productId,
          sri.product_name AS productName,
          sri.quantity,
          sri.restore_inventory AS restoreInventory,
          CAST(sri.inventory_movement_id AS CHAR) AS inventoryMovementId,
          CAST(sri.net_amount AS CHAR) AS netAmount,
          CAST(sri.tax_amount AS CHAR) AS taxAmount,
          CAST(sri.total_amount AS CHAR) AS totalAmount,
          CAST(sri.cost_amount AS CHAR) AS costAmount,
          sri.created_at AS createdAt
        FROM sale_refund_items AS sri
        INNER JOIN sale_refunds AS sr
          ON sr.business_id = sri.business_id
          AND sr.id = sri.refund_id
        WHERE
          sr.business_id = ?
          AND sr.sale_id = ?
        ORDER BY
          sri.refund_id DESC,
          sri.id ASC
      `,
      [businessId, saleId],
    ),

    databasePool.execute<SaleRefundPaymentRow[]>(
      `
        SELECT
          CAST(srp.id AS CHAR) AS id,
          CAST(srp.business_id AS CHAR) AS businessId,
          CAST(srp.refund_id AS CHAR) AS refundId,
          CAST(srp.sale_payment_id AS CHAR) AS salePaymentId,
          CAST(srp.processed_by_membership_id AS CHAR)
            AS processedByMembershipId,
          processed_user.full_name AS processedByName,
          CAST(srp.cash_movement_id AS CHAR) AS cashMovementId,
          srp.payment_method_code AS paymentMethodCode,
          srp.payment_method_name AS paymentMethodName,
          srp.payment_type AS paymentType,
          srp.requires_reference AS requiresReference,
          srp.affects_cash AS affectsCash,
          CAST(srp.amount AS CHAR) AS amount,
          srp.reference,
          srp.notes,
          srp.created_at AS createdAt
        FROM sale_refund_payments AS srp
        INNER JOIN sale_refunds AS sr
          ON sr.business_id = srp.business_id
          AND sr.id = srp.refund_id
        INNER JOIN business_memberships AS processed_membership
          ON processed_membership.business_id = srp.business_id
          AND processed_membership.id =
            srp.processed_by_membership_id
        INNER JOIN users AS processed_user
          ON processed_user.id = processed_membership.user_id
        WHERE
          sr.business_id = ?
          AND sr.sale_id = ?
        ORDER BY
          srp.refund_id DESC,
          srp.id ASC
      `,
      [businessId, saleId],
    ),
  ]);

  const [refundRows] = refundResult;
  const [itemRows] = itemResult;
  const [paymentRows] = paymentResult;

  const items = itemRows.map(mapSaleRefundItemRow);
  const payments = paymentRows.map(mapSaleRefundPaymentRow);

  return refundRows.map((refundRow) =>
    mapSaleRefundRow(
      refundRow,
      items.filter((item) => item.refundId === refundRow.id),
      payments.filter((payment) => payment.refundId === refundRow.id),
    ),
  );
};

const findSaleRefundById = async (
  businessId: string,
  saleId: string,
  refundId: string,
): Promise<SaleRefund | null> => {
  const [refundRows] = await databasePool.execute<SaleRefundRow[]>(
    `
      SELECT
        CAST(sr.id AS CHAR) AS id,
        CAST(sr.business_id AS CHAR) AS businessId,
        CAST(sr.sale_id AS CHAR) AS saleId,
        CAST(sr.cash_session_id AS CHAR) AS cashSessionId,
        CAST(sr.processed_by_membership_id AS CHAR)
          AS processedByMembershipId,
        processed_user.full_name AS processedByName,
        sr.refund_kind AS refundKind,
        sr.reason,
        CAST(sr.net_amount AS CHAR) AS netAmount,
        CAST(sr.tax_amount AS CHAR) AS taxAmount,
        CAST(sr.total_amount AS CHAR) AS totalAmount,
        CAST(sr.cost_amount AS CHAR) AS costAmount,
        sr.refunded_at AS refundedAt,
        sr.created_at AS createdAt
      FROM sale_refunds AS sr
      INNER JOIN business_memberships AS processed_membership
        ON processed_membership.business_id = sr.business_id
        AND processed_membership.id = sr.processed_by_membership_id
      INNER JOIN users AS processed_user
        ON processed_user.id = processed_membership.user_id
      WHERE
        sr.business_id = ?
        AND sr.sale_id = ?
        AND sr.id = ?
      LIMIT 1
    `,
    [businessId, saleId, refundId],
  );

  const refundRow = refundRows[0];

  if (!refundRow) {
    return null;
  }

  const [itemResult, paymentResult] = await Promise.all([
    databasePool.execute<SaleRefundItemRow[]>(
      `
        SELECT
          CAST(sri.id AS CHAR) AS id,
          CAST(sri.business_id AS CHAR) AS businessId,
          CAST(sri.refund_id AS CHAR) AS refundId,
          CAST(sri.sale_item_id AS CHAR) AS saleItemId,
          CAST(sri.product_id AS CHAR) AS productId,
          sri.product_name AS productName,
          sri.quantity,
          sri.restore_inventory AS restoreInventory,
          CAST(sri.inventory_movement_id AS CHAR) AS inventoryMovementId,
          CAST(sri.net_amount AS CHAR) AS netAmount,
          CAST(sri.tax_amount AS CHAR) AS taxAmount,
          CAST(sri.total_amount AS CHAR) AS totalAmount,
          CAST(sri.cost_amount AS CHAR) AS costAmount,
          sri.created_at AS createdAt
        FROM sale_refund_items AS sri
        WHERE
          sri.business_id = ?
          AND sri.refund_id = ?
        ORDER BY sri.id ASC
      `,
      [businessId, refundId],
    ),

    databasePool.execute<SaleRefundPaymentRow[]>(
      `
        SELECT
          CAST(srp.id AS CHAR) AS id,
          CAST(srp.business_id AS CHAR) AS businessId,
          CAST(srp.refund_id AS CHAR) AS refundId,
          CAST(srp.sale_payment_id AS CHAR) AS salePaymentId,
          CAST(srp.processed_by_membership_id AS CHAR)
            AS processedByMembershipId,
          processed_user.full_name AS processedByName,
          CAST(srp.cash_movement_id AS CHAR) AS cashMovementId,
          srp.payment_method_code AS paymentMethodCode,
          srp.payment_method_name AS paymentMethodName,
          srp.payment_type AS paymentType,
          srp.requires_reference AS requiresReference,
          srp.affects_cash AS affectsCash,
          CAST(srp.amount AS CHAR) AS amount,
          srp.reference,
          srp.notes,
          srp.created_at AS createdAt
        FROM sale_refund_payments AS srp
        INNER JOIN business_memberships AS processed_membership
          ON processed_membership.business_id = srp.business_id
          AND processed_membership.id =
            srp.processed_by_membership_id
        INNER JOIN users AS processed_user
          ON processed_user.id = processed_membership.user_id
        WHERE
          srp.business_id = ?
          AND srp.refund_id = ?
        ORDER BY srp.id ASC
      `,
      [businessId, refundId],
    ),
  ]);

  const [itemRows] = itemResult;
  const [paymentRows] = paymentResult;

  return mapSaleRefundRow(
    refundRow,
    itemRows.map(mapSaleRefundItemRow),
    paymentRows.map(mapSaleRefundPaymentRow),
  );
};

export { findSaleRefundById, findSaleRefunds };
