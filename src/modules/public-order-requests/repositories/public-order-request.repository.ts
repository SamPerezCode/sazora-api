import { randomUUID } from "node:crypto";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { KitchenPreparationStatus } from "../../kitchen-tickets/kitchen-ticket.types";
import type { OrderStatus } from "../../orders/order.types";

import type {
  CreatePublicOrderRequestData,
  PublicOrderRequest,
  PublicOrderRequestItem,
  PublicOrderRequestListItem,
  PublicOrderRequestServiceType,
  PublicOrderRequestStatus,
  PublicOrderTracking,
  PublicOrderTrackingPreparationStatus,
} from "../public-order-request.types";

type PublicOrderTrackingRow = RowDataPacket & {
  requestId: string;
  businessId: string;
  businessName: string;
  publicCode: string;
  serviceType: PublicOrderRequestServiceType;
  requestStatus: PublicOrderRequestStatus;
  orderId: string | null;
  orderStatus: OrderStatus | null;
  subtotal: string;
  rejectionReason: string | null;
  fulfillmentStatus:
    | "PENDING_ASSIGNMENT"
    | "ASSIGNED"
    | "PICKED_UP"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | null;
  createdAt: Date;
  updatedAt: Date;
};

type PublicOrderTrackingItemRow = RowDataPacket & {
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
};

type PublicOrderPreparationRow = RowDataPacket & {
  preparationStatus: KitchenPreparationStatus;
};

type BusinessRow = RowDataPacket & {
  businessId: string;
  timezone: string;
};

type ProductRow = RowDataPacket & {
  id: string;
  name: string;
  currentPrice: string;
};

type RequestRow = RowDataPacket & {
  id: string;
  publicCode: string;
  businessId: string;
  serviceType: PublicOrderRequestServiceType;
  status: PublicOrderRequestStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  subtotal: string;
  handledByMembershipId: string | null;
  orderId: string | null;
  contactedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RequestListRow = RequestRow & {
  itemCount: string;
};

type RequestItemRow = RowDataPacket & {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
};

type AssignmentRecipientRow = RowDataPacket & {
  membershipId: string;
  scheduleRank: number;
  priority: number;
};

type CreateRequestResult =
  | Readonly<{
      kind: "BUSINESS_NOT_AVAILABLE";
    }>
  | Readonly<{
      kind: "PRODUCTS_NOT_AVAILABLE";
      productIds: readonly string[];
    }>
  | Readonly<{
      kind: "CREATED";
      request: PublicOrderRequest;
      timezone: string;
    }>;

interface PublicOrderRequestOrderContextRow extends RowDataPacket {
  requestId: string;
  publicCode: string;
  serviceType: PublicOrderRequestServiceType;
}

interface PublicOrderRequestOrderContext {
  requestId: string;
  publicCode: string;
  serviceType: PublicOrderRequestServiceType;
}
const requestSelect = `
  SELECT
    CAST(por.id AS CHAR) AS id,
    por.public_code AS publicCode,
    CAST(por.business_id AS CHAR) AS businessId,
    por.service_type AS serviceType,
    por.status,
    por.customer_name AS customerName,
    por.customer_phone AS customerPhone,
    por.customer_email AS customerEmail,
    por.delivery_address AS deliveryAddress,
    por.notes,
    CAST(por.subtotal AS CHAR) AS subtotal,
    CAST(por.handled_by_membership_id AS CHAR)
      AS handledByMembershipId,
    CAST(por.order_id AS CHAR) AS orderId,
    por.contacted_at AS contactedAt,
    por.accepted_at AS acceptedAt,
    por.rejected_at AS rejectedAt,
    por.cancelled_at AS cancelledAt,
    por.rejection_reason AS rejectionReason,
    por.created_at AS createdAt,
    por.updated_at AS updatedAt
  FROM public_order_requests AS por
`;

const mapRequestRow = (
  row: RequestRow,
  items: readonly PublicOrderRequestItem[],
): PublicOrderRequest => ({
  id: row.id,
  publicCode: row.publicCode,
  businessId: row.businessId,
  serviceType: row.serviceType,
  status: row.status,
  customerName: row.customerName,
  customerPhone: row.customerPhone,
  customerEmail: row.customerEmail,
  deliveryAddress: row.deliveryAddress,
  notes: row.notes,
  subtotal: row.subtotal,
  handledByMembershipId: row.handledByMembershipId,
  orderId: row.orderId,
  contactedAt: row.contactedAt,
  acceptedAt: row.acceptedAt,
  rejectedAt: row.rejectedAt,
  cancelledAt: row.cancelledAt,
  rejectionReason: row.rejectionReason,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  items,
});

const moneyToCents = (value: string): bigint => {
  const [whole = "0", fraction = ""] = value.split(".");

  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
};

const centsToMoney = (value: bigint): string => {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");

  return `${whole.toString()}.${fraction}`;
};

const findPublicOrderRequestById = async (
  businessId: string,
  requestId: string,
): Promise<PublicOrderRequest | null> => {
  const [requestRows] = await databasePool.execute<RequestRow[]>(
    `
      ${requestSelect}
      WHERE
        por.business_id = ?
        AND por.id = ?
      LIMIT 1
    `,
    [businessId, requestId],
  );

  const requestRow = requestRows[0];

  if (!requestRow) {
    return null;
  }

  const [itemRows] = await databasePool.execute<RequestItemRow[]>(
    `
      SELECT
        CAST(id AS CHAR) AS id,
        CAST(product_id AS CHAR) AS productId,
        product_name AS productName,
        quantity,
        CAST(unit_price AS CHAR) AS unitPrice,
        CAST(line_total AS CHAR) AS lineTotal,
        notes
      FROM public_order_request_items
      WHERE
        business_id = ?
        AND public_order_request_id = ?
      ORDER BY id ASC
    `,
    [businessId, requestId],
  );

  return mapRequestRow(requestRow, itemRows);
};

const findPublicOrderRequestsByBusinessId = async (
  businessId: string,
): Promise<PublicOrderRequestListItem[]> => {
  const [rows] = await databasePool.execute<RequestListRow[]>(
    `
      SELECT
        request_data.*,
        (
          SELECT COUNT(*)
          FROM public_order_request_items AS pori
          WHERE
            pori.business_id = request_data.businessId
            AND pori.public_order_request_id = request_data.id
        ) AS itemCount
      FROM (
        ${requestSelect}
        WHERE por.business_id = ?
      ) AS request_data
      ORDER BY request_data.createdAt DESC
    `,
    [businessId],
  );

  return rows.map((row) => {
    const request = mapRequestRow(row, []);
    const { items: _items, ...requestSummary } = request;

    return {
      ...requestSummary,
      itemCount: Number(row.itemCount),
    };
  });
};

const createPublicOrderRequestRecord = async (
  businessSlug: string,
  data: CreatePublicOrderRequestData,
): Promise<CreateRequestResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [businessRows] = await connection.execute<BusinessRow[]>(
      `
        SELECT
          CAST(b.id AS CHAR) AS businessId,
          b.timezone
        FROM businesses AS b
        INNER JOIN business_settings AS bs
          ON bs.business_id = b.id
        WHERE
          b.slug = ?
          AND b.is_active = TRUE
          AND bs.public_menu_enabled = TRUE
          AND bs.public_ordering_enabled = TRUE
        LIMIT 1
        FOR SHARE
      `,
      [businessSlug],
    );

    const business = businessRows[0];

    if (!business) {
      await connection.rollback();

      return {
        kind: "BUSINESS_NOT_AVAILABLE",
      };
    }

    const productIds = data.items.map((item) => item.productId);

    const placeholders = productIds.map(() => "?").join(", ");

    const [productRows] = await connection.execute<ProductRow[]>(
      `
        SELECT
          CAST(p.id AS CHAR) AS id,
          p.name,
          CAST(p.current_price AS CHAR) AS currentPrice
        FROM products AS p
        INNER JOIN categories AS c
          ON c.business_id = p.business_id
          AND c.id = p.category_id
        INNER JOIN preparation_areas AS pa
          ON pa.business_id = p.business_id
          AND pa.id = p.preparation_area_id
        WHERE
          p.business_id = ?
          AND p.id IN (${placeholders})
          AND p.is_active = TRUE
          AND p.is_publicly_visible = TRUE
          AND p.is_publicly_orderable = TRUE
          AND c.is_active = TRUE
          AND c.is_publicly_visible = TRUE
          AND pa.is_active = TRUE
        FOR SHARE
      `,
      [business.businessId, ...productIds],
    );

    const productById = new Map(
      productRows.map((product) => [product.id, product]),
    );

    const unavailableProductIds = productIds.filter(
      (productId) => !productById.has(productId),
    );

    if (unavailableProductIds.length > 0) {
      await connection.rollback();

      return {
        kind: "PRODUCTS_NOT_AVAILABLE",
        productIds: unavailableProductIds,
      };
    }

    let subtotalInCents = 0n;

    const calculatedItems = data.items.map((item) => {
      const product = productById.get(item.productId);

      if (!product) {
        throw new Error("No fue posible recuperar un producto validado");
      }

      const lineTotalInCents =
        moneyToCents(product.currentPrice) * BigInt(item.quantity);

      subtotalInCents += lineTotalInCents;

      return {
        ...item,
        productName: product.name,
        unitPrice: product.currentPrice,
        lineTotal: centsToMoney(lineTotalInCents),
      };
    });

    const publicCode = randomUUID();

    const [requestResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO public_order_requests (
            public_code,
            business_id,
            service_type,
            customer_name,
            customer_phone,
            customer_email,
            delivery_address,
            notes,
            subtotal
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        publicCode,
        business.businessId,
        data.serviceType,
        data.customerName,
        data.customerPhone,
        data.customerEmail,
        data.deliveryAddress,
        data.notes,
        centsToMoney(subtotalInCents),
      ],
    );

    const requestId = requestResult.insertId.toString();

    for (const item of calculatedItems) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO public_order_request_items (
            business_id,
            public_order_request_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            line_total,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          business.businessId,
          requestId,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.lineTotal,
          item.notes,
        ],
      );
    }

    await connection.commit();

    const request = await findPublicOrderRequestById(
      business.businessId,
      requestId,
    );

    if (!request) {
      throw new Error("No fue posible recuperar la solicitud creada");
    }

    return {
      kind: "CREATED",
      request,
      timezone: business.timezone,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const findEffectiveAssignmentRecipients = async (
  businessId: string,
  serviceType: PublicOrderRequestServiceType,
  localDate: string,
  localDayOfWeek: number,
  localTime: string,
): Promise<AssignmentRecipientRow[]> => {
  const [rows] = await databasePool.execute<AssignmentRecipientRow[]>(
    `
      SELECT
      CAST(poa.assigned_membership_id AS CHAR)
        AS membershipId,
        CASE
          WHEN poa.specific_date IS NOT NULL THEN 3
          WHEN poa.day_of_week IS NOT NULL THEN 2
          ELSE 1
        END AS scheduleRank,
        poa.priority
      FROM public_order_assignments AS poa
      INNER JOIN business_memberships AS bm
        ON bm.business_id = poa.business_id
        AND bm.id = poa.assigned_membership_id
        AND bm.is_active = TRUE
      INNER JOIN users AS u
        ON u.id = bm.user_id
        AND u.is_active = TRUE
      INNER JOIN business_membership_roles AS bmr
        ON bmr.business_membership_id = bm.id
        AND bmr.is_active = TRUE
      INNER JOIN roles AS r
        ON r.id = bmr.role_id
        AND r.is_active = TRUE
        AND r.code = 'PUBLIC_ORDER_MANAGER'
      WHERE
        poa.business_id = ?
        AND poa.is_active = TRUE
        AND poa.service_scope IN ('ALL', ?)
        AND (
          (
            poa.specific_date = ?
            AND ? >= poa.start_time
            AND ? < poa.end_time
          )
          OR
          (
            poa.specific_date IS NULL
            AND poa.day_of_week = ?
            AND ? >= poa.start_time
            AND ? < poa.end_time
          )
          OR
          (
            poa.specific_date IS NULL
            AND poa.day_of_week IS NULL
            AND poa.start_time IS NULL
            AND poa.end_time IS NULL
          )
        )
      ORDER BY
        scheduleRank DESC,
        poa.priority DESC,
        poa.id ASC
    `,
    [
      businessId,
      serviceType,
      localDate,
      localTime,
      localTime,
      localDayOfWeek,
      localTime,
      localTime,
    ],
  );

  const firstRecipient = rows[0];

  if (!firstRecipient) {
    return [];
  }

  return rows.filter(
    (row) =>
      row.scheduleRank === firstRecipient.scheduleRank &&
      row.priority === firstRecipient.priority,
  );
};

const findPublicOrderRequestContextByOrderId = async (
  businessId: string,
  orderId: string,
): Promise<PublicOrderRequestOrderContext | null> => {
  const [rows] = await databasePool.execute<
    PublicOrderRequestOrderContextRow[]
  >(
    `
      SELECT
        CAST(id AS CHAR) AS requestId,
        public_code AS publicCode,
        service_type AS serviceType
      FROM public_order_requests
      WHERE
        business_id = ?
        AND order_id = ?
        AND status = 'ACCEPTED'
      LIMIT 1
    `,
    [businessId, orderId],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    requestId: row.requestId,
    publicCode: row.publicCode,
    serviceType: row.serviceType,
  };
};

const calculatePublicPreparationStatus = (
  orderStatus: OrderStatus | null,
  preparationStatuses: readonly KitchenPreparationStatus[],
): PublicOrderTrackingPreparationStatus | null => {
  if (orderStatus === "DELIVERED" || orderStatus === "CLOSED") {
    return "DELIVERED";
  }

  if (orderStatus !== "CONFIRMED") {
    return null;
  }

  const activeStatuses = preparationStatuses.filter(
    (status) => status !== "CANCELLED",
  );

  if (activeStatuses.length === 0) {
    return null;
  }

  if (activeStatuses.every((status) => status === "DELIVERED")) {
    return "DELIVERED";
  }

  if (
    activeStatuses.every(
      (status) => status === "READY" || status === "DELIVERED",
    )
  ) {
    return "READY";
  }

  if (
    activeStatuses.some(
      (status) =>
        status === "IN_PREPARATION" ||
        status === "READY" ||
        status === "DELIVERED",
    )
  ) {
    return "IN_PREPARATION";
  }

  return "PENDING";
};

const findPublicOrderTracking = async (
  businessSlug: string,
  publicCode: string,
): Promise<PublicOrderTracking | null> => {
  const [trackingRows] = await databasePool.execute<PublicOrderTrackingRow[]>(
    `
      SELECT
        CAST(por.id AS CHAR) AS requestId,
        CAST(por.business_id AS CHAR) AS businessId,
        b.name AS businessName,
        por.public_code AS publicCode,
        por.service_type AS serviceType,
        por.status AS requestStatus,
        CAST(por.order_id AS CHAR) AS orderId,
        o.status AS orderStatus,
        CAST(por.subtotal AS CHAR) AS subtotal,
        por.rejection_reason AS rejectionReason,
        pod.status AS fulfillmentStatus,
        por.created_at AS createdAt,
        por.updated_at AS updatedAt
      FROM public_order_requests AS por
      INNER JOIN businesses AS b
        ON b.id = por.business_id
      LEFT JOIN orders AS o
        ON o.business_id = por.business_id
        AND o.id = por.order_id
        LEFT JOIN public_order_deliveries AS pod
      ON pod.business_id = por.business_id
      AND pod.public_order_request_id = por.id
      WHERE
        b.slug = ?
        AND por.public_code = ?
      LIMIT 1
    `,
    [businessSlug, publicCode],
  );

  const tracking = trackingRows[0];

  if (!tracking) {
    return null;
  }

  const [itemRows] = await databasePool.execute<PublicOrderTrackingItemRow[]>(
    `
      SELECT
        product_name AS productName,
        quantity,
        CAST(unit_price AS CHAR) AS unitPrice,
        CAST(line_total AS CHAR) AS lineTotal,
        notes
      FROM public_order_request_items
      WHERE
        business_id = ?
        AND public_order_request_id = ?
      ORDER BY id ASC
    `,
    [tracking.businessId, tracking.requestId],
  );

  let preparationStatuses: KitchenPreparationStatus[] = [];

  if (tracking.orderId) {
    const [preparationRows] = await databasePool.execute<
      PublicOrderPreparationRow[]
    >(
      `
        SELECT preparation_status AS preparationStatus
        FROM kitchen_ticket_items
        WHERE
          business_id = ?
          AND order_id = ?
        ORDER BY id ASC
      `,
      [tracking.businessId, tracking.orderId],
    );

    preparationStatuses = preparationRows.map((row) => row.preparationStatus);
  }

  return {
    businessName: tracking.businessName,
    publicCode: tracking.publicCode,
    serviceType: tracking.serviceType,
    requestStatus: tracking.requestStatus,
    orderStatus: tracking.orderStatus,
    preparationStatus: calculatePublicPreparationStatus(
      tracking.orderStatus,
      preparationStatuses,
    ),
    subtotal: tracking.subtotal,
    rejectionReason: tracking.rejectionReason,
    fulfillmentStatus: tracking.fulfillmentStatus,
    createdAt: tracking.createdAt,
    updatedAt: tracking.updatedAt,
    items: itemRows.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      notes: item.notes,
    })),
  };
};

export {
  createPublicOrderRequestRecord,
  findEffectiveAssignmentRecipients,
  findPublicOrderRequestById,
  findPublicOrderRequestContextByOrderId,
  findPublicOrderRequestsByBusinessId,
  findPublicOrderTracking,
};
export type { CreateRequestResult, PublicOrderRequestOrderContext };
