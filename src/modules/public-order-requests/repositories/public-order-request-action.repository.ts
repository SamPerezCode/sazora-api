import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { OrderDetail } from "../../orders/order.types";
import { findOrderDetailById } from "../../orders/repositories/get-order.repository";
import type { ProductFulfillmentMode } from "../../products/product.types";
import type {
  PublicOrderRequest,
  PublicOrderRequestServiceType,
  PublicOrderRequestStatus,
} from "../public-order-request.types";
import { findPublicOrderRequestById } from "./public-order-request.repository";

type RequestStateRow = RowDataPacket & {
  status: PublicOrderRequestStatus;
  serviceType: PublicOrderRequestServiceType;
  notes: string | null;
};

type RequestItemForOrderRow = RowDataPacket & {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  notes: string | null;
  preparationAreaId: string;
  fulfillmentMode: ProductFulfillmentMode;
  isOperationallyAvailable: number;
};

type TransitionResult =
  | Readonly<{
      kind: "UPDATED";
      previousStatus: PublicOrderRequestStatus;
      request: PublicOrderRequest;
    }>
  | Readonly<{
      kind: "NOT_FOUND";
    }>
  | Readonly<{
      kind: "NOT_ACTIONABLE";
      currentStatus: PublicOrderRequestStatus;
    }>;

type AcceptRequestResult =
  | Readonly<{
      kind: "ACCEPTED";
      previousStatus: PublicOrderRequestStatus;
      request: PublicOrderRequest;
      order: OrderDetail;
    }>
  | Readonly<{
      kind: "NOT_FOUND";
    }>
  | Readonly<{
      kind: "NOT_ACTIONABLE";
      currentStatus: PublicOrderRequestStatus;
    }>
  | Readonly<{
      kind: "PRODUCT_UNAVAILABLE";
    }>;

const markPublicOrderRequestContacted = async (
  businessId: string,
  requestId: string,
  membershipId: string,
): Promise<TransitionResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<RequestStateRow[]>(
      `
        SELECT
          status,
          service_type AS serviceType,
          notes
        FROM public_order_requests
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, requestId],
    );

    const currentRequest = rows[0];

    if (!currentRequest) {
      await connection.rollback();

      return {
        kind: "NOT_FOUND",
      };
    }

    if (
      currentRequest.status !== "NEW" &&
      currentRequest.status !== "CONTACTED"
    ) {
      await connection.rollback();

      return {
        kind: "NOT_ACTIONABLE",
        currentStatus: currentRequest.status,
      };
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE public_order_requests
        SET
          status = 'CONTACTED',
          handled_by_membership_id = ?,
          contacted_at = COALESCE(
            contacted_at,
            CURRENT_TIMESTAMP(3)
          )
        WHERE
          business_id = ?
          AND id = ?
      `,
      [membershipId, businessId, requestId],
    );

    await connection.commit();

    const updatedRequest = await findPublicOrderRequestById(
      businessId,
      requestId,
    );

    if (!updatedRequest) {
      throw new Error("No fue posible recuperar la solicitud contactada");
    }

    return {
      kind: "UPDATED",
      previousStatus: currentRequest.status,
      request: updatedRequest,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const rejectPublicOrderRequestRecord = async (
  businessId: string,
  requestId: string,
  membershipId: string,
  reason: string,
): Promise<TransitionResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute<RequestStateRow[]>(
      `
        SELECT
          status,
          service_type AS serviceType,
          notes
        FROM public_order_requests
        WHERE
          business_id = ?
          AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [businessId, requestId],
    );

    const currentRequest = rows[0];

    if (!currentRequest) {
      await connection.rollback();

      return {
        kind: "NOT_FOUND",
      };
    }

    if (
      currentRequest.status !== "NEW" &&
      currentRequest.status !== "CONTACTED"
    ) {
      await connection.rollback();

      return {
        kind: "NOT_ACTIONABLE",
        currentStatus: currentRequest.status,
      };
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE public_order_requests
        SET
          status = 'REJECTED',
          handled_by_membership_id = ?,
          rejected_at = CURRENT_TIMESTAMP(3),
          rejection_reason = ?
        WHERE
          business_id = ?
          AND id = ?
      `,
      [membershipId, reason, businessId, requestId],
    );

    await connection.commit();

    const updatedRequest = await findPublicOrderRequestById(
      businessId,
      requestId,
    );

    if (!updatedRequest) {
      throw new Error("No fue posible recuperar la solicitud rechazada");
    }

    return {
      kind: "UPDATED",
      previousStatus: currentRequest.status,
      request: updatedRequest,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const acceptPublicOrderRequestRecord = async (
  businessId: string,
  requestId: string,
  membershipId: string,
): Promise<AcceptRequestResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [requestRows] = await connection.execute<RequestStateRow[]>(
      `
          SELECT
            status,
            service_type AS serviceType,
            notes
          FROM public_order_requests
          WHERE
            business_id = ?
            AND id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, requestId],
    );

    const currentRequest = requestRows[0];

    if (!currentRequest) {
      await connection.rollback();

      return {
        kind: "NOT_FOUND",
      };
    }

    if (
      currentRequest.status !== "NEW" &&
      currentRequest.status !== "CONTACTED"
    ) {
      await connection.rollback();

      return {
        kind: "NOT_ACTIONABLE",
        currentStatus: currentRequest.status,
      };
    }

    const [itemRows] = await connection.execute<RequestItemForOrderRow[]>(
      `
          SELECT
            CAST(pori.product_id AS CHAR) AS productId,
            pori.product_name AS productName,
            pori.quantity,
            CAST(pori.unit_price AS CHAR) AS unitPrice,
            pori.notes,
            CAST(p.preparation_area_id AS CHAR)
              AS preparationAreaId,
            p.fulfillment_mode AS fulfillmentMode,
            (
              p.is_active = TRUE
              AND c.is_active = TRUE
              AND pa.is_active = TRUE
            ) AS isOperationallyAvailable
          FROM public_order_request_items AS pori
          INNER JOIN products AS p
            ON p.business_id = pori.business_id
            AND p.id = pori.product_id
          INNER JOIN categories AS c
            ON c.business_id = p.business_id
            AND c.id = p.category_id
          INNER JOIN preparation_areas AS pa
            ON pa.business_id = p.business_id
            AND pa.id = p.preparation_area_id
          WHERE
            pori.business_id = ?
            AND pori.public_order_request_id = ?
          ORDER BY pori.id ASC
          FOR SHARE
        `,
      [businessId, requestId],
    );

    if (
      itemRows.length === 0 ||
      itemRows.some((item) => !item.isOperationallyAvailable)
    ) {
      await connection.rollback();

      return {
        kind: "PRODUCT_UNAVAILABLE",
      };
    }

    const [orderResult] = await connection.execute<ResultSetHeader>(
      `
          INSERT INTO orders (
            business_id,
            restaurant_table_id,
            opened_by_membership_id,
            service_type,
            customer_count,
            notes
          )
          VALUES (?, NULL, ?, ?, NULL, ?)
        `,
      [
        businessId,
        membershipId,
        currentRequest.serviceType,
        currentRequest.notes,
      ],
    );

    const orderId = orderResult.insertId.toString();

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
        VALUES (
          ?,
          ?,
          ?,
          NULL,
          'OPEN',
          'Creada desde una solicitud del menú público'
        )
      `,
      [businessId, orderId, membershipId],
    );

    for (const item of itemRows) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO order_items (
            business_id,
            order_id,
            product_id,
            preparation_area_id,
            fulfillment_mode,
            added_by_membership_id,
            product_name,
            quantity,
            unit_price,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          businessId,
          orderId,
          item.productId,
          item.preparationAreaId,
          item.fulfillmentMode,
          membershipId,
          item.productName,
          item.quantity,
          item.unitPrice,
          item.notes,
        ],
      );
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE public_order_requests
        SET
          status = 'ACCEPTED',
          handled_by_membership_id = ?,
          order_id = ?,
          accepted_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
      `,
      [membershipId, orderId, businessId, requestId],
    );

    if (currentRequest.serviceType === "DELIVERY") {
      const [deliveryResult] = await connection.execute<ResultSetHeader>(
        `
        INSERT INTO public_order_deliveries (
          business_id,
          public_order_request_id,
          order_id
        )
        VALUES (?, ?, ?)
      `,
        [businessId, requestId, orderId],
      );

      await connection.execute<ResultSetHeader>(
        `
      INSERT INTO public_order_delivery_status_history (
        business_id,
        delivery_id,
        changed_by_membership_id,
        previous_status,
        new_status,
        reason
      )
      VALUES (
        ?,
        ?,
        ?,
        NULL,
        'PENDING_ASSIGNMENT',
        'Domicilio creado al aceptar la solicitud pública'
      )
    `,
        [businessId, deliveryResult.insertId.toString(), membershipId],
      );
    }

    await connection.commit();

    const [updatedRequest, order] = await Promise.all([
      findPublicOrderRequestById(businessId, requestId),
      findOrderDetailById(businessId, orderId),
    ]);

    if (!updatedRequest || !order) {
      throw new Error("No fue posible recuperar la solicitud aceptada");
    }

    return {
      kind: "ACCEPTED",
      previousStatus: currentRequest.status,
      request: updatedRequest,
      order,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export {
  acceptPublicOrderRequestRecord,
  markPublicOrderRequestContacted,
  rejectPublicOrderRequestRecord,
};

export type { AcceptRequestResult, TransitionResult };
