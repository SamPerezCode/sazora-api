import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type { Delivery, DeliveryMode, DeliveryStatus } from "../delivery.types";
type DeliveryRow = RowDataPacket & {
  id: string;
  businessId: string;
  publicOrderRequestId: string;
  publicCode: string;
  orderId: string;
  orderStatus: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  assignedDriverMembershipId: string | null;
  assignedDriverName: string | null;
  assignedByMembershipId: string | null;
  deliveryMode: DeliveryMode | null;
  externalProviderName: string | null;
  status: DeliveryStatus;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const deliverySelect = `
  SELECT
    CAST(pod.id AS CHAR) AS id,
    CAST(pod.business_id AS CHAR) AS businessId,
    CAST(pod.public_order_request_id AS CHAR)
      AS publicOrderRequestId,
    por.public_code AS publicCode,
    CAST(pod.order_id AS CHAR) AS orderId,
    o.status AS orderStatus,
    pod.delivery_mode AS deliveryMode,
    por.customer_name AS customerName,
    por.customer_phone AS customerPhone,
    por.delivery_address AS deliveryAddress,
    CAST(pod.assigned_driver_membership_id AS CHAR)
      AS assignedDriverMembershipId,
      pod.external_provider_name AS externalProviderName,
    driver.full_name AS assignedDriverName,
    CAST(pod.assigned_by_membership_id AS CHAR)
      AS assignedByMembershipId,
    pod.status,
    pod.assigned_at AS assignedAt,
    pod.picked_up_at AS pickedUpAt,
    pod.out_for_delivery_at AS outForDeliveryAt,
    pod.delivered_at AS deliveredAt,
    pod.cancelled_at AS cancelledAt,
    pod.created_at AS createdAt,
    pod.updated_at AS updatedAt
  FROM public_order_deliveries AS pod
  INNER JOIN public_order_requests AS por
    ON por.business_id = pod.business_id
    AND por.id = pod.public_order_request_id
  INNER JOIN orders AS o
    ON o.business_id = pod.business_id
    AND o.id = pod.order_id
  LEFT JOIN business_memberships AS driver_membership
    ON driver_membership.business_id = pod.business_id
    AND driver_membership.id = pod.assigned_driver_membership_id
  LEFT JOIN users AS driver
    ON driver.id = driver_membership.user_id
`;

const mapDeliveryRow = (row: DeliveryRow): Delivery => ({
  id: row.id,
  businessId: row.businessId,
  publicOrderRequestId: row.publicOrderRequestId,
  publicCode: row.publicCode,
  orderId: row.orderId,
  orderStatus: row.orderStatus,
  customerName: row.customerName,
  customerPhone: row.customerPhone,
  deliveryAddress: row.deliveryAddress,
  deliveryMode: row.deliveryMode,
  assignedDriverMembershipId: row.assignedDriverMembershipId,
  assignedDriverName: row.assignedDriverName,
  externalProviderName: row.externalProviderName,
  assignedByMembershipId: row.assignedByMembershipId,
  status: row.status,
  assignedAt: row.assignedAt,
  pickedUpAt: row.pickedUpAt,
  outForDeliveryAt: row.outForDeliveryAt,
  deliveredAt: row.deliveredAt,
  cancelledAt: row.cancelledAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findDeliveryById = async (
  businessId: string,
  deliveryId: string,
): Promise<Delivery | null> => {
  const [rows] = await databasePool.execute<DeliveryRow[]>(
    `
      ${deliverySelect}
      WHERE
        pod.business_id = ?
        AND pod.id = ?
      LIMIT 1
    `,
    [businessId, deliveryId],
  );

  return rows[0] ? mapDeliveryRow(rows[0]) : null;
};

const findDeliveryByRequestId = async (
  businessId: string,
  requestId: string,
): Promise<Delivery | null> => {
  const [rows] = await databasePool.execute<DeliveryRow[]>(
    `
      ${deliverySelect}
      WHERE
        pod.business_id = ?
        AND pod.public_order_request_id = ?
      LIMIT 1
    `,
    [businessId, requestId],
  );

  return rows[0] ? mapDeliveryRow(rows[0]) : null;
};

const findDeliveries = async (
  businessId: string,
  assignedDriverMembershipId?: string,
): Promise<Delivery[]> => {
  const driverCondition = assignedDriverMembershipId
    ? "AND pod.assigned_driver_membership_id = ?"
    : "";

  const values = assignedDriverMembershipId
    ? [businessId, assignedDriverMembershipId]
    : [businessId];

  const [rows] = await databasePool.execute<DeliveryRow[]>(
    `
      ${deliverySelect}
      WHERE
        pod.business_id = ?
        ${driverCondition}
      ORDER BY
        FIELD(
          pod.status,
          'OUT_FOR_DELIVERY',
          'PICKED_UP',
          'ASSIGNED',
          'PENDING_ASSIGNMENT',
          'DELIVERED',
          'CANCELLED'
        ),
        pod.created_at ASC
    `,
    values,
  );

  return rows.map(mapDeliveryRow);
};

export { findDeliveries, findDeliveryById, findDeliveryByRequestId };
