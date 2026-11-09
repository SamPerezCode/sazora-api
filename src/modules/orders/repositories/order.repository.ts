import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type { KitchenWorkflowMode } from "../../kitchen-settings/kitchen-settings.types";
import { formatDateInTimezone } from "../../../shared/dates/local-date";
import type { TaxType } from "../../tax-classes/tax-class.types";
import { calculateOrderItemTax } from "../order-tax-calculation";
import type {
  CreateOrderData,
  Order,
  OrderServiceType,
  OrderStatus,
} from "../order.types";

type OrderRow = RowDataPacket & {
  id: string;
  businessId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: "PRODUCTION_WAREHOUSE" | "POINT_OF_SALE";
  locationIsActive: number;
  restaurantTableId: string | null;
  openedByMembershipId: string;
  serviceType: OrderServiceType;
  status: OrderStatus;
  kitchenWorkflowMode: KitchenWorkflowMode | null;
  customerCount: number | null;
  notes: string | null;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LocationStateRow = RowDataPacket & {
  locationType: "PRODUCTION_WAREHOUSE" | "POINT_OF_SALE";
  isActive: number;
};

type RestaurantTableStateRow = RowDataPacket & {
  locationId: string;
  isActive: number;
};

type ActiveOrderRow = RowDataPacket & {
  id: string;
};

type BusinessTimezoneRow = RowDataPacket & {
  timezone: string;
};

type AvailableProductRow = RowDataPacket & {
  id: string;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  name: string;
  currentPrice: string;
  taxClassId: string | null;
  taxCode: string | null;
  taxName: string | null;
  taxType: TaxType | null;
  taxRate: string | null;
  priceIncludesTax: number;
  isAvailable: number;
};

type CreateOrderResult =
  | Readonly<{
      kind: "CREATED";
      order: Order;
    }>
  | Readonly<{
      kind: "TABLE_NOT_FOUND";
    }>
  | Readonly<{
      kind: "TABLE_INACTIVE";
    }>
  | Readonly<{
      kind: "TABLE_OCCUPIED";
    }>
  | Readonly<{
      kind: "PRODUCT_NOT_FOUND";
    }>
  | Readonly<{
      kind: "PRODUCT_UNAVAILABLE";
    }>
  | Readonly<{ kind: "LOCATION_NOT_AVAILABLE" }>
  | Readonly<{ kind: "LOCATION_NOT_POINT_OF_SALE" }>
  | Readonly<{ kind: "TABLE_LOCATION_MISMATCH" }>
  | Readonly<{ kind: "PRODUCT_NOT_AVAILABLE_AT_LOCATION" }>;

const mapOrderRow = (row: OrderRow): Order => ({
  id: row.id,
  businessId: row.businessId,
  locationId: row.locationId,
  location: {
    id: row.locationId,
    code: row.locationCode,
    name: row.locationName,
    locationType: row.locationType,
    isActive: Boolean(row.locationIsActive),
  },
  restaurantTableId: row.restaurantTableId,
  openedByMembershipId: row.openedByMembershipId,
  serviceType: row.serviceType,
  status: row.status,
  kitchenWorkflowMode: row.kitchenWorkflowMode,
  customerCount: row.customerCount,
  notes: row.notes,
  confirmedAt: row.confirmedAt,
  deliveredAt: row.deliveredAt,
  closedAt: row.closedAt,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const createOrder = async (
  businessId: string,
  data: CreateOrderData,
): Promise<CreateOrderResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [locationRows] = await connection.execute<LocationStateRow[]>(
      `
    SELECT
      location_type AS locationType,
      is_active AS isActive
    FROM business_locations
    WHERE
      business_id = ?
      AND id = ?
    LIMIT 1
    FOR SHARE
  `,
      [businessId, data.locationId],
    );

    const location = locationRows[0];

    if (!location || location.isActive === 0) {
      await connection.rollback();

      return {
        kind: "LOCATION_NOT_AVAILABLE",
      };
    }

    if (location.locationType !== "POINT_OF_SALE") {
      await connection.rollback();

      return {
        kind: "LOCATION_NOT_POINT_OF_SALE",
      };
    }

    if (data.serviceType === "TABLE") {
      const [tableRows] = await connection.execute<RestaurantTableStateRow[]>(
        `
    SELECT
      CAST(location_id AS CHAR) AS locationId,
      is_active AS isActive
    FROM restaurant_tables
    WHERE
      business_id = ?
      AND id = ?
    LIMIT 1
    FOR UPDATE
  `,
        [businessId, data.restaurantTableId],
      );

      const restaurantTable = tableRows[0];

      if (!restaurantTable) {
        await connection.rollback();

        return {
          kind: "TABLE_NOT_FOUND",
        };
      }

      if (restaurantTable.locationId !== data.locationId) {
        await connection.rollback();

        return {
          kind: "TABLE_LOCATION_MISMATCH",
        };
      }

      if (!restaurantTable.isActive) {
        await connection.rollback();

        return {
          kind: "TABLE_INACTIVE",
        };
      }

      const [activeOrderRows] = await connection.execute<ActiveOrderRow[]>(
        `
          SELECT
            CAST(id AS CHAR) AS id
          FROM orders
          WHERE
            business_id = ?
            AND restaurant_table_id = ?
            AND status IN (
              'OPEN',
              'CONFIRMED',
              'DELIVERED'
            )
          LIMIT 1
        `,
        [businessId, data.restaurantTableId],
      );

      if (activeOrderRows[0]) {
        await connection.rollback();

        return {
          kind: "TABLE_OCCUPIED",
        };
      }
    }

    const [businessRows] = await connection.execute<BusinessTimezoneRow[]>(
      `
      SELECT timezone
      FROM businesses
      WHERE id = ?
      LIMIT 1
    `,
      [businessId],
    );

    const business = businessRows[0];

    if (!business) {
      throw new Error("No fue posible recuperar la zona horaria del negocio");
    }

    const effectiveTaxDate = formatDateInTimezone(
      new Date(),
      business.timezone,
    );

    const productIds = [...new Set(data.items.map((item) => item.productId))];

    const productPlaceholders = productIds.map(() => "?").join(", ");

    const [productRows] = await connection.execute<AvailableProductRow[]>(
      `
      SELECT
        CAST(p.id AS CHAR) AS id,
        CAST(p.preparation_area_id AS CHAR)
          AS preparationAreaId,
        p.fulfillment_mode AS fulfillmentMode,
        p.name,
        CAST(p.current_price AS CHAR)
          AS currentPrice,
        CAST(p.tax_class_id AS CHAR)
          AS taxClassId,
        tc.code AS taxCode,
        tc.name AS taxName,
        tc.tax_type AS taxType,
        CAST(tr.rate AS CHAR) AS taxRate,
        p.price_includes_tax AS priceIncludesTax,
        (
          p.is_active = TRUE
          AND c.is_active = TRUE
          AND pa.is_active = TRUE
          AND (
            p.tax_class_id IS NULL
            OR (
              tc.is_active = TRUE
              AND tr.id IS NOT NULL
            )
          )
        ) AS isAvailable
      FROM products AS p
      INNER JOIN categories AS c
        ON c.business_id = p.business_id
        AND c.id = p.category_id
      INNER JOIN preparation_areas AS pa
        ON pa.business_id = p.business_id
        AND pa.id = p.preparation_area_id
      LEFT JOIN tax_classes AS tc
        ON tc.business_id = p.business_id
        AND tc.id = p.tax_class_id
      LEFT JOIN tax_rates AS tr
        ON tr.business_id = p.business_id
        AND tr.tax_class_id = p.tax_class_id
        AND tr.is_active = TRUE
        AND tr.valid_from <= ?
        AND (
          tr.valid_to IS NULL
          OR tr.valid_to >= ?
        )
      WHERE
        p.business_id = ?
        AND p.id IN (${productPlaceholders})
      FOR SHARE
    `,
      [effectiveTaxDate, effectiveTaxDate, businessId, ...productIds],
    );

    const productsById = new Map(
      productRows.map((product) => [product.id, product]),
    );

    for (const item of data.items) {
      const product = productsById.get(item.productId);

      if (!product) {
        await connection.rollback();

        return {
          kind: "PRODUCT_NOT_FOUND",
        };
      }

      if (!product.isAvailable) {
        await connection.rollback();

        return {
          kind: "PRODUCT_UNAVAILABLE",
        };
      }
    }

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
    INSERT INTO orders (
      business_id,
      location_id,
      restaurant_table_id,
      opened_by_membership_id,
      service_type,
      customer_count,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
      [
        businessId,
        data.locationId,
        data.restaurantTableId,
        data.openedByMembershipId,
        data.serviceType,
        data.customerCount,
        data.notes,
      ],
    );

    const orderId = insertResult.insertId.toString();

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO order_status_history (
          business_id,
          order_id,
          changed_by_membership_id,
          previous_status,
          new_status,
          reason
        )
        VALUES (?, ?, ?, NULL, 'OPEN', NULL)
      `,
      [businessId, orderId, data.openedByMembershipId],
    );

    for (const item of data.items) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new Error(
          "No fue posible recuperar un producto previamente validado",
        );
      }

      const taxCalculation = calculateOrderItemTax({
        listedUnitPrice: product.currentPrice,
        taxRate: product.taxRate ?? "0.0000",
        priceIncludesTax: Boolean(product.priceIncludesTax),
      });

      const [orderItemInsertResult] = await connection.execute<ResultSetHeader>(
        `
      INSERT INTO order_items (
        business_id,
        order_id,
        product_id,
        tax_class_id,
        preparation_area_id,
        fulfillment_mode,
        added_by_membership_id,
        product_name,
        quantity,
        unit_price,
        tax_code,
        tax_name,
        tax_type,
        tax_rate,
        price_includes_tax,
        unit_net_price,
        unit_tax_amount,
        notes
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
        [
          businessId,
          orderId,
          product.id,
          product.taxClassId,
          product.preparationAreaId,
          product.fulfillmentMode,
          data.openedByMembershipId,
          product.name,
          item.quantity,
          taxCalculation.unitPrice,
          product.taxCode,
          product.taxName,
          product.taxType,
          product.taxRate ?? "0.0000",
          Boolean(product.priceIncludesTax),
          taxCalculation.unitNetPrice,
          taxCalculation.unitTaxAmount,
          item.notes,
        ],
      );

      const orderItemId = orderItemInsertResult.insertId.toString();

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO order_item_changes (
            business_id,
            order_item_id,
            changed_by_membership_id,
            change_type,
            previous_quantity,
            new_quantity,
            previous_notes,
            new_notes,
            reason
          )
          VALUES (
            ?,
            ?,
            ?,
            'ADDED',
            NULL,
            ?,
            NULL,
            ?,
            NULL
          )
        `,
        [
          businessId,
          orderItemId,
          data.openedByMembershipId,
          item.quantity,
          item.notes,
        ],
      );
    }

    const [orderRows] = await connection.execute<OrderRow[]>(
      `
    SELECT
      CAST(o.id AS CHAR) AS id,
      CAST(o.business_id AS CHAR) AS businessId,
      CAST(o.location_id AS CHAR) AS locationId,
      bl.code AS locationCode,
      bl.name AS locationName,
      bl.location_type AS locationType,
      bl.is_active AS locationIsActive,
      CAST(o.restaurant_table_id AS CHAR) AS restaurantTableId,
      CAST(o.opened_by_membership_id AS CHAR)
        AS openedByMembershipId,
      o.service_type AS serviceType,
      o.status,
      o.customer_count AS customerCount,
      o.notes,
      o.confirmed_at AS confirmedAt,
      o.delivered_at AS deliveredAt,
      o.closed_at AS closedAt,
      o.cancelled_at AS cancelledAt,
      o.created_at AS createdAt,
      o.updated_at AS updatedAt
    FROM orders AS o
    INNER JOIN business_locations AS bl
      ON bl.business_id = o.business_id
      AND bl.id = o.location_id
    WHERE
      o.business_id = ?
      AND o.id = ?
    LIMIT 1
  `,
      [businessId, orderId],
    );

    const createdOrder = orderRows[0];

    if (!createdOrder) {
      throw new Error("No fue posible recuperar la orden creada");
    }

    await connection.commit();

    return {
      kind: "CREATED",
      order: mapOrderRow(createdOrder),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export { createOrder };
export type { CreateOrderResult };
