import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";
import type {
  DeliveryMode,
  DeliveryStatus,
  DeliveryStatusChange,
} from "../delivery.types";
import { findDeliveryById } from "./delivery.repository";

type LockedDeliveryRow = RowDataPacket & {
  id: string;
  orderId: string;
  deliveryMode: DeliveryMode | null;
  status: DeliveryStatus;
  assignedDriverMembershipId: string | null;
  orderStatus: string;
};

type CountRow = RowDataPacket & {
  total: string;
};

type DriverRow = RowDataPacket & {
  id: string;
};

type DeliveryActionError =
  | "DELIVERY_NOT_FOUND"
  | "DRIVER_NOT_ELIGIBLE"
  | "DELIVERY_NOT_ASSIGNABLE"
  | "DELIVERY_NOT_ASSIGNED_TO_DRIVER"
  | "INVALID_DELIVERY_TRANSITION"
  | "ORDER_NOT_READY";

type DeliveryActionFailure = {
  [ErrorKind in DeliveryActionError]: Readonly<{
    kind: ErrorKind;
  }>;
}[DeliveryActionError];

type DeliveryActionResult =
  | Readonly<{
      kind: "UPDATED";
      change: DeliveryStatusChange;
    }>
  | DeliveryActionFailure;

const insertHistory = async (
  connection: Awaited<ReturnType<typeof databasePool.getConnection>>,
  businessId: string,
  deliveryId: string,
  membershipId: string,
  previousStatus: DeliveryStatus,
  newStatus: DeliveryStatus,
): Promise<void> => {
  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO public_order_delivery_status_history (
        business_id,
        delivery_id,
        changed_by_membership_id,
        previous_status,
        new_status
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [businessId, deliveryId, membershipId, previousStatus, newStatus],
  );
};

const assignDeliveryDriver = async (
  businessId: string,
  requestId: string,
  assignedByMembershipId: string,
  deliveryMode: DeliveryMode | null,
  driverMembershipId: string | null,
  externalProviderName: string | null,
): Promise<DeliveryActionResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    if (deliveryMode === "INTERNAL" && driverMembershipId === null) {
      await connection.rollback();

      return {
        kind: "DRIVER_NOT_ELIGIBLE",
      };
    }

    if (deliveryMode === "INTERNAL" && driverMembershipId !== null) {
      const [driverRows] = await connection.execute<DriverRow[]>(
        `
            SELECT
              CAST(bm.id AS CHAR) AS id
            FROM business_memberships AS bm
            INNER JOIN users AS u
              ON u.id = bm.user_id
              AND u.is_active = TRUE
            INNER JOIN business_membership_roles AS bmr
              ON bmr.business_membership_id = bm.id
              AND bmr.is_active = TRUE
            INNER JOIN roles AS r
              ON r.id = bmr.role_id
              AND r.is_active = TRUE
              AND r.code = 'DELIVERY_DRIVER'
            WHERE
              bm.business_id = ?
              AND bm.id = ?
              AND bm.is_active = TRUE
            LIMIT 1
            FOR SHARE
          `,
        [businessId, driverMembershipId],
      );

      if (!driverRows[0]) {
        await connection.rollback();

        return {
          kind: "DRIVER_NOT_ELIGIBLE",
        };
      }
    }

    const [deliveryRows] = await connection.execute<LockedDeliveryRow[]>(
      `
          SELECT
            CAST(pod.id AS CHAR) AS id,
            CAST(pod.order_id AS CHAR) AS orderId,
            pod.delivery_mode AS deliveryMode,
            pod.status,
            CAST(
              pod.assigned_driver_membership_id AS CHAR
            ) AS assignedDriverMembershipId,
            o.status AS orderStatus
          FROM public_order_deliveries AS pod
          INNER JOIN orders AS o
            ON o.business_id = pod.business_id
            AND o.id = pod.order_id
          WHERE
            pod.business_id = ?
            AND pod.public_order_request_id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, requestId],
    );

    const current = deliveryRows[0];

    if (!current) {
      await connection.rollback();

      return {
        kind: "DELIVERY_NOT_FOUND",
      };
    }

    if (
      current.status !== "PENDING_ASSIGNMENT" &&
      current.status !== "ASSIGNED"
    ) {
      await connection.rollback();

      return {
        kind: "DELIVERY_NOT_ASSIGNABLE",
      };
    }

    const newStatus: DeliveryStatus =
      deliveryMode === null ? "PENDING_ASSIGNMENT" : "ASSIGNED";

    await connection.execute<ResultSetHeader>(
      `
        UPDATE public_order_deliveries
        SET
          delivery_mode = ?,
          assigned_driver_membership_id = ?,
          external_provider_name = ?,
          assigned_by_membership_id = ?,
          status = ?,
          assigned_at = CASE
            WHEN ? IS NULL THEN NULL
            ELSE CURRENT_TIMESTAMP(3)
          END
        WHERE
          business_id = ?
          AND id = ?
      `,
      [
        deliveryMode,
        deliveryMode === "INTERNAL" ? driverMembershipId : null,
        deliveryMode === "EXTERNAL" ? externalProviderName : null,
        deliveryMode === null ? null : assignedByMembershipId,
        newStatus,
        deliveryMode,
        businessId,
        current.id,
      ],
    );

    if (current.status !== newStatus) {
      await insertHistory(
        connection,
        businessId,
        current.id,
        assignedByMembershipId,
        current.status,
        newStatus,
      );
    }

    await connection.commit();

    const delivery = await findDeliveryById(businessId, current.id);

    if (!delivery) {
      throw new Error("No fue posible recuperar el domicilio configurado");
    }

    return {
      kind: "UPDATED",
      change: {
        delivery,
        previousStatus: current.status,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const transitionDriverDelivery = async (
  businessId: string,
  actorMembershipId: string,
  canManageExternal: boolean,
  deliveryId: string,
  expectedStatus: DeliveryStatus,
  newStatus: DeliveryStatus,
): Promise<DeliveryActionResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [deliveryRows] = await connection.execute<LockedDeliveryRow[]>(
      `
          SELECT
            CAST(pod.id AS CHAR) AS id,
            CAST(pod.order_id AS CHAR) AS orderId,
            pod.delivery_mode AS deliveryMode,
            pod.status,
            CAST(
              pod.assigned_driver_membership_id AS CHAR
            ) AS assignedDriverMembershipId,
            o.status AS orderStatus
          FROM public_order_deliveries AS pod
          INNER JOIN orders AS o
            ON o.business_id = pod.business_id
            AND o.id = pod.order_id
          WHERE
            pod.business_id = ?
            AND pod.id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, deliveryId],
    );

    const current = deliveryRows[0];

    if (!current) {
      await connection.rollback();

      return {
        kind: "DELIVERY_NOT_FOUND",
      };
    }

    const canOperateInternal =
      current.deliveryMode === "INTERNAL" &&
      current.assignedDriverMembershipId === actorMembershipId;

    const canOperateExternal =
      current.deliveryMode === "EXTERNAL" && canManageExternal;

    if (!canOperateInternal && !canOperateExternal) {
      await connection.rollback();

      return {
        kind: "DELIVERY_NOT_ASSIGNED_TO_DRIVER",
      };
    }

    if (current.status !== expectedStatus) {
      await connection.rollback();

      return {
        kind: "INVALID_DELIVERY_TRANSITION",
      };
    }

    if (newStatus === "PICKED_UP") {
      const [countRows] = await connection.execute<CountRow[]>(
        `
            SELECT
              CAST(COUNT(*) AS CHAR) AS total
            FROM kitchen_ticket_items
            WHERE
              business_id = ?
              AND order_id = ?
              AND preparation_status NOT IN (
                'READY',
                'DELIVERED',
                'CANCELLED'
              )
          `,
        [businessId, current.orderId],
      );

      const notReadyItems = Number(countRows[0]?.total ?? 0);

      if (current.orderStatus !== "CONFIRMED" || notReadyItems > 0) {
        await connection.rollback();

        return {
          kind: "ORDER_NOT_READY",
        };
      }
    }

    const timestampColumn =
      newStatus === "PICKED_UP" ? "picked_up_at" : "out_for_delivery_at";

    await connection.execute<ResultSetHeader>(
      `
        UPDATE public_order_deliveries
        SET
          status = ?,
          ${timestampColumn} = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
      `,
      [newStatus, businessId, deliveryId],
    );

    await insertHistory(
      connection,
      businessId,
      deliveryId,
      actorMembershipId,
      current.status,
      newStatus,
    );

    await connection.commit();

    const delivery = await findDeliveryById(businessId, deliveryId);

    if (!delivery) {
      throw new Error("No fue posible recuperar el domicilio actualizado");
    }

    return {
      kind: "UPDATED",
      change: {
        delivery,
        previousStatus: current.status,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const markDeliveryDelivered = async (
  businessId: string,
  actorMembershipId: string,
  canManageExternal: boolean,
  deliveryId: string,
): Promise<DeliveryActionResult> => {
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [deliveryRows] = await connection.execute<LockedDeliveryRow[]>(
      `
          SELECT
            CAST(pod.id AS CHAR) AS id,
            CAST(pod.order_id AS CHAR) AS orderId,
            pod.delivery_mode AS deliveryMode,
            pod.status,
            CAST(
              pod.assigned_driver_membership_id AS CHAR
            ) AS assignedDriverMembershipId,
            o.status AS orderStatus
          FROM public_order_deliveries AS pod
          INNER JOIN orders AS o
            ON o.business_id = pod.business_id
            AND o.id = pod.order_id
          WHERE
            pod.business_id = ?
            AND pod.id = ?
          LIMIT 1
          FOR UPDATE
        `,
      [businessId, deliveryId],
    );

    const current = deliveryRows[0];

    if (!current) {
      await connection.rollback();

      return {
        kind: "DELIVERY_NOT_FOUND",
      };
    }

    const canOperateInternal =
      current.deliveryMode === "INTERNAL" &&
      current.assignedDriverMembershipId === actorMembershipId;

    const canOperateExternal =
      current.deliveryMode === "EXTERNAL" && canManageExternal;

    if (!canOperateInternal && !canOperateExternal) {
      await connection.rollback();

      return {
        kind: "DELIVERY_NOT_ASSIGNED_TO_DRIVER",
      };
    }

    if (
      current.status !== "OUT_FOR_DELIVERY" ||
      current.orderStatus !== "CONFIRMED"
    ) {
      await connection.rollback();

      return {
        kind: "INVALID_DELIVERY_TRANSITION",
      };
    }

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO kitchen_item_status_history (
          business_id,
          kitchen_ticket_item_id,
          changed_by_membership_id,
          previous_status,
          new_status,
          reason
        )
        SELECT
          business_id,
          id,
          ?,
          preparation_status,
          'DELIVERED',
          'Entrega confirmada desde el módulo de domicilios'
        FROM kitchen_ticket_items
        WHERE
          business_id = ?
          AND order_id = ?
          AND preparation_status = 'READY'
      `,
      [actorMembershipId, businessId, current.orderId],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE kitchen_ticket_items
        SET
          preparation_status = 'DELIVERED',
          delivered_at = CURRENT_TIMESTAMP(3),
          last_changed_by_membership_id = ?
        WHERE
          business_id = ?
          AND order_id = ?
          AND preparation_status = 'READY'
      `,
      [actorMembershipId, businessId, current.orderId],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE orders
        SET
          status = 'DELIVERED',
          delivered_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
          AND status = 'CONFIRMED'
      `,
      [businessId, current.orderId],
    );

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
          'CONFIRMED',
          'DELIVERED',
          'Entrega confirmada desde el módulo de domicilios'
        )
      `,
      [businessId, current.orderId, actorMembershipId],
    );

    await connection.execute<ResultSetHeader>(
      `
        UPDATE public_order_deliveries
        SET
          status = 'DELIVERED',
          delivered_at = CURRENT_TIMESTAMP(3)
        WHERE
          business_id = ?
          AND id = ?
      `,
      [businessId, deliveryId],
    );

    await insertHistory(
      connection,
      businessId,
      deliveryId,
      actorMembershipId,
      current.status,
      "DELIVERED",
    );

    await connection.commit();

    const delivery = await findDeliveryById(businessId, deliveryId);

    if (!delivery) {
      throw new Error("No fue posible recuperar el domicilio entregado");
    }

    return {
      kind: "UPDATED",
      change: {
        delivery,
        previousStatus: current.status,
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
  assignDeliveryDriver,
  markDeliveryDelivered,
  transitionDriverDelivery,
};

export type { DeliveryActionResult };
