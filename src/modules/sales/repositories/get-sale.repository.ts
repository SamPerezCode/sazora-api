import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { LocationType } from "../../locations/location.types";
import type { PaymentType } from "../../payment-methods/payment-method.types";
import type { TaxType } from "../../tax-classes/tax-class.types";
import type { Sale, SaleItem, SalePayment, SaleStatus } from "../sale.types";

interface SaleRow extends RowDataPacket {
  id: string;
  businessId: string;
  locationId: string;
  orderId: string;
  cashSessionId: string;
  commercialCustomerId: string | null;
  soldByMembershipId: string;
  soldByName: string;
  locationCode: string;
  locationName: string;
  locationType: LocationType;
  status: SaleStatus;
  currencyCode: string;
  netSubtotal: string;
  taxTotal: string;
  discountTotal: string;
  tipTotal: string;
  total: string;
  paidTotal: string;
  changeTotal: string;
  voidedByMembershipId: string | null;
  voidReason: string | null;
  voidedAt: Date | null;
  soldAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface SaleItemRow extends RowDataPacket {
  id: string;
  businessId: string;
  saleId: string;
  orderItemId: string;
  productId: string;
  categoryId: string | null;
  preparationAreaId: string | null;
  taxClassId: string | null;
  productName: string;
  categoryName: string | null;
  preparationAreaName: string | null;
  quantity: number;
  unitPrice: string;
  taxCode: string | null;
  taxName: string | null;
  taxType: TaxType | null;
  taxRate: string;
  priceIncludesTax: number;
  unitNetPrice: string;
  unitTaxAmount: string;
  discountAmount: string;
  lineNetTotal: string;
  lineTaxTotal: string;
  lineTotal: string;
  costTotal: string | null;
  grossProfitAmount: string | null;
  createdAt: Date;
}

interface SalePaymentRow extends RowDataPacket {
  id: string;
  businessId: string;
  saleId: string;
  paymentMethodId: string;
  processedByMembershipId: string;
  processedByName: string;
  cashMovementId: string | null;
  paymentMethodCode: string;
  paymentMethodName: string;
  paymentType: PaymentType;
  requiresReference: number;
  affectsCash: number;
  allowsChange: number;
  amount: string;
  tenderedAmount: string;
  changeAmount: string;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  createdAt: Date;
}

const mapSaleItemRow = (row: SaleItemRow): SaleItem => ({
  id: row.id,
  businessId: row.businessId,
  saleId: row.saleId,
  orderItemId: row.orderItemId,
  productId: row.productId,
  categoryId: row.categoryId,
  preparationAreaId: row.preparationAreaId,
  taxClassId: row.taxClassId,
  productName: row.productName,
  categoryName: row.categoryName,
  preparationAreaName: row.preparationAreaName,
  quantity: row.quantity,
  unitPrice: row.unitPrice,
  taxCode: row.taxCode,
  taxName: row.taxName,
  taxType: row.taxType,
  taxRate: row.taxRate,
  priceIncludesTax: Boolean(row.priceIncludesTax),
  unitNetPrice: row.unitNetPrice,
  unitTaxAmount: row.unitTaxAmount,
  discountAmount: row.discountAmount,
  lineNetTotal: row.lineNetTotal,
  lineTaxTotal: row.lineTaxTotal,
  lineTotal: row.lineTotal,
  costTotal: row.costTotal,
  grossProfitAmount: row.grossProfitAmount,
  createdAt: row.createdAt,
});

const mapSalePaymentRow = (row: SalePaymentRow): SalePayment => ({
  id: row.id,
  businessId: row.businessId,
  saleId: row.saleId,
  paymentMethodId: row.paymentMethodId,
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
  allowsChange: Boolean(row.allowsChange),
  amount: row.amount,
  tenderedAmount: row.tenderedAmount,
  changeAmount: row.changeAmount,
  reference: row.reference,
  notes: row.notes,
  paidAt: row.paidAt,
  createdAt: row.createdAt,
});

const findSaleById = async (
  businessId: string,
  saleId: string,
): Promise<Sale | null> => {
  const [saleRows] = await databasePool.execute<SaleRow[]>(
    `
      SELECT
        CAST(s.id AS CHAR) AS id,
        CAST(s.business_id AS CHAR) AS businessId,
        CAST(s.location_id AS CHAR) AS locationId,
        CAST(s.order_id AS CHAR) AS orderId,
        CAST(s.cash_session_id AS CHAR) AS cashSessionId,
        CAST(s.commercial_customer_id AS CHAR) AS commercialCustomerId,
        CAST(s.sold_by_membership_id AS CHAR) AS soldByMembershipId,
        sold_user.full_name AS soldByName,
        bl.code AS locationCode,
        bl.name AS locationName,
        bl.location_type AS locationType,
        s.status,
        s.currency_code AS currencyCode,
        CAST(s.net_subtotal AS CHAR) AS netSubtotal,
        CAST(s.tax_total AS CHAR) AS taxTotal,
        CAST(s.discount_total AS CHAR) AS discountTotal,
        CAST(s.tip_total AS CHAR) AS tipTotal,
        CAST(s.total AS CHAR) AS total,
        CAST(s.paid_total AS CHAR) AS paidTotal,
        CAST(s.change_total AS CHAR) AS changeTotal,
        CAST(s.voided_by_membership_id AS CHAR) AS voidedByMembershipId,
        s.void_reason AS voidReason,
        s.voided_at AS voidedAt,
        s.sold_at AS soldAt,
        s.created_at AS createdAt,
        s.updated_at AS updatedAt
      FROM sales AS s
      INNER JOIN business_locations AS bl
        ON bl.business_id = s.business_id
        AND bl.id = s.location_id
      INNER JOIN business_memberships AS sold_membership
        ON sold_membership.business_id = s.business_id
        AND sold_membership.id = s.sold_by_membership_id
      INNER JOIN users AS sold_user
        ON sold_user.id = sold_membership.user_id
      WHERE
        s.business_id = ?
        AND s.id = ?
      LIMIT 1
    `,
    [businessId, saleId],
  );

  const saleRow = saleRows[0];

  if (!saleRow) {
    return null;
  }

  const [itemResult, paymentResult] = await Promise.all([
    databasePool.execute<SaleItemRow[]>(
      `
        SELECT
          CAST(si.id AS CHAR) AS id,
          CAST(si.business_id AS CHAR) AS businessId,
          CAST(si.sale_id AS CHAR) AS saleId,
          CAST(si.order_item_id AS CHAR) AS orderItemId,
          CAST(si.product_id AS CHAR) AS productId,
          CAST(si.category_id AS CHAR) AS categoryId,
          CAST(si.preparation_area_id AS CHAR) AS preparationAreaId,
          CAST(si.tax_class_id AS CHAR) AS taxClassId,
          si.product_name AS productName,
          si.category_name AS categoryName,
          si.preparation_area_name AS preparationAreaName,
          si.quantity,
          CAST(si.unit_price AS CHAR) AS unitPrice,
          si.tax_code AS taxCode,
          si.tax_name AS taxName,
          si.tax_type AS taxType,
          CAST(si.tax_rate AS CHAR) AS taxRate,
          si.price_includes_tax AS priceIncludesTax,
          CAST(si.unit_net_price AS CHAR) AS unitNetPrice,
          CAST(si.unit_tax_amount AS CHAR) AS unitTaxAmount,
          CAST(si.discount_amount AS CHAR) AS discountAmount,
          CAST(si.line_net_total AS CHAR) AS lineNetTotal,
          CAST(si.line_tax_total AS CHAR) AS lineTaxTotal,
          CAST(si.line_total AS CHAR) AS lineTotal,
          CAST(si.cost_total AS CHAR) AS costTotal,
          CAST(si.gross_profit_amount AS CHAR) AS grossProfitAmount,
          si.created_at AS createdAt
        FROM sale_items AS si
        WHERE
          si.business_id = ?
          AND si.sale_id = ?
        ORDER BY si.id ASC
      `,
      [businessId, saleId],
    ),

    databasePool.execute<SalePaymentRow[]>(
      `
        SELECT
          CAST(sp.id AS CHAR) AS id,
          CAST(sp.business_id AS CHAR) AS businessId,
          CAST(sp.sale_id AS CHAR) AS saleId,
          CAST(sp.payment_method_id AS CHAR) AS paymentMethodId,
          CAST(sp.processed_by_membership_id AS CHAR)
            AS processedByMembershipId,
          processed_user.full_name AS processedByName,
          CAST(sp.cash_movement_id AS CHAR) AS cashMovementId,
          sp.payment_method_code AS paymentMethodCode,
          sp.payment_method_name AS paymentMethodName,
          sp.payment_type AS paymentType,
          sp.requires_reference AS requiresReference,
          sp.affects_cash AS affectsCash,
          sp.allows_change AS allowsChange,
          CAST(sp.amount AS CHAR) AS amount,
          CAST(sp.tendered_amount AS CHAR) AS tenderedAmount,
          CAST(sp.change_amount AS CHAR) AS changeAmount,
          sp.reference,
          sp.notes,
          sp.paid_at AS paidAt,
          sp.created_at AS createdAt
        FROM sale_payments AS sp
        INNER JOIN business_memberships AS processed_membership
          ON processed_membership.business_id = sp.business_id
          AND processed_membership.id = sp.processed_by_membership_id
        INNER JOIN users AS processed_user
          ON processed_user.id = processed_membership.user_id
        WHERE
          sp.business_id = ?
          AND sp.sale_id = ?
        ORDER BY
          sp.paid_at ASC,
          sp.id ASC
      `,
      [businessId, saleId],
    ),
  ]);

  const [itemRows] = itemResult;
  const [paymentRows] = paymentResult;

  return {
    id: saleRow.id,
    businessId: saleRow.businessId,
    locationId: saleRow.locationId,
    orderId: saleRow.orderId,
    cashSessionId: saleRow.cashSessionId,
    commercialCustomerId: saleRow.commercialCustomerId,
    soldByMembershipId: saleRow.soldByMembershipId,
    soldBy: {
      membershipId: saleRow.soldByMembershipId,
      fullName: saleRow.soldByName,
    },
    location: {
      id: saleRow.locationId,
      code: saleRow.locationCode,
      name: saleRow.locationName,
      locationType: saleRow.locationType,
    },
    status: saleRow.status,
    currencyCode: saleRow.currencyCode,
    netSubtotal: saleRow.netSubtotal,
    taxTotal: saleRow.taxTotal,
    discountTotal: saleRow.discountTotal,
    tipTotal: saleRow.tipTotal,
    total: saleRow.total,
    paidTotal: saleRow.paidTotal,
    changeTotal: saleRow.changeTotal,
    voidedByMembershipId: saleRow.voidedByMembershipId,
    voidReason: saleRow.voidReason,
    voidedAt: saleRow.voidedAt,
    soldAt: saleRow.soldAt,
    createdAt: saleRow.createdAt,
    updatedAt: saleRow.updatedAt,
    items: itemRows.map(mapSaleItemRow),
    payments: paymentRows.map(mapSalePaymentRow),
  };
};

export { findSaleById };
