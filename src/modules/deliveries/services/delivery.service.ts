import { emitDeliveryStatusUpdated } from "../../../realtime/realtime.events";
import { AppError } from "../../../shared/errors/app-error";
import {
  assignDeliveryDriver,
  markDeliveryDelivered,
  transitionDriverDelivery,
} from "../repositories/delivery-action.repository";
import {
  findDeliveries,
  findDeliveryById,
} from "../repositories/delivery.repository";
import type { Delivery, DeliveryMode } from "../delivery.types";

const handleActionResult = (
  result: Awaited<ReturnType<typeof assignDeliveryDriver>>,
): Delivery => {
  if (result.kind === "UPDATED") {
    const { delivery, previousStatus } = result.change;

    try {
      emitDeliveryStatusUpdated({
        businessId: delivery.businessId,
        deliveryId: delivery.id,
        requestId: delivery.publicOrderRequestId,
        publicCode: delivery.publicCode,
        orderId: delivery.orderId,
        previousStatus,
        status: delivery.status,
        assignedDriverMembershipId: delivery.assignedDriverMembershipId,
        deliveryMode: delivery.deliveryMode,
        externalProviderName: delivery.externalProviderName,
        changedAt: delivery.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("No fue posible emitir el estado del domicilio", error);
    }

    return delivery;
  }

  switch (result.kind) {
    case "DELIVERY_NOT_FOUND":
      throw new AppError("El domicilio no existe", 404, "DELIVERY_NOT_FOUND");

    case "DRIVER_NOT_ELIGIBLE":
      throw new AppError(
        "El empleado debe estar activo y tener el rol DELIVERY_DRIVER",
        409,
        "DRIVER_NOT_ELIGIBLE",
      );

    case "DELIVERY_NOT_ASSIGNABLE":
      throw new AppError(
        "El domicilio ya no permite cambiar de domiciliario",
        409,
        "DELIVERY_NOT_ASSIGNABLE",
      );

    case "DELIVERY_NOT_ASSIGNED_TO_DRIVER":
      throw new AppError(
        "El domicilio no está asignado a este empleado",
        403,
        "DELIVERY_NOT_ASSIGNED_TO_DRIVER",
      );

    case "INVALID_DELIVERY_TRANSITION":
      throw new AppError(
        "La transición del domicilio no está permitida",
        409,
        "INVALID_DELIVERY_TRANSITION",
      );

    case "ORDER_NOT_READY":
      throw new AppError(
        "Todos los productos deben estar listos antes de recibir el domicilio",
        409,
        "DELIVERY_ORDER_NOT_READY",
      );
  }
};

const listDeliveries = async (
  businessId: string,
  membershipId: string,
  roles: readonly string[],
): Promise<Delivery[]> => {
  const canViewAll =
    roles.includes("ADMIN") || roles.includes("PUBLIC_ORDER_MANAGER");

  return findDeliveries(businessId, canViewAll ? undefined : membershipId);
};

const getDelivery = async (
  businessId: string,
  membershipId: string,
  roles: readonly string[],
  deliveryId: string,
): Promise<Delivery> => {
  const delivery = await findDeliveryById(businessId, deliveryId);

  if (!delivery) {
    throw new AppError("El domicilio no existe", 404, "DELIVERY_NOT_FOUND");
  }

  const canViewAll =
    roles.includes("ADMIN") || roles.includes("PUBLIC_ORDER_MANAGER");

  if (!canViewAll && delivery.assignedDriverMembershipId !== membershipId) {
    throw new AppError(
      "No tienes acceso a este domicilio",
      403,
      "DELIVERY_ACCESS_DENIED",
    );
  }

  return delivery;
};

const configureDelivery = async (
  businessId: string,
  assignedByMembershipId: string,
  requestId: string,
  deliveryMode: DeliveryMode | null,
  driverMembershipId: string | null,
  externalProviderName: string | null,
): Promise<Delivery> =>
  handleActionResult(
    await assignDeliveryDriver(
      businessId,
      requestId,
      assignedByMembershipId,
      deliveryMode,
      driverMembershipId,
      externalProviderName,
    ),
  );

const pickUpDelivery = async (
  businessId: string,
  actorMembershipId: string,
  roles: readonly string[],
  deliveryId: string,
): Promise<Delivery> =>
  handleActionResult(
    await transitionDriverDelivery(
      businessId,
      actorMembershipId,
      canManageExternalDelivery(roles),
      deliveryId,
      "ASSIGNED",
      "PICKED_UP",
    ),
  );

const startDelivery = async (
  businessId: string,
  actorMembershipId: string,
  roles: readonly string[],
  deliveryId: string,
): Promise<Delivery> =>
  handleActionResult(
    await transitionDriverDelivery(
      businessId,
      actorMembershipId,
      canManageExternalDelivery(roles),
      deliveryId,
      "PICKED_UP",
      "OUT_FOR_DELIVERY",
    ),
  );

const deliverDelivery = async (
  businessId: string,
  actorMembershipId: string,
  roles: readonly string[],
  deliveryId: string,
): Promise<Delivery> =>
  handleActionResult(
    await markDeliveryDelivered(
      businessId,
      actorMembershipId,
      canManageExternalDelivery(roles),
      deliveryId,
    ),
  );

const canManageExternalDelivery = (roles: readonly string[]): boolean =>
  roles.includes("ADMIN") || roles.includes("PUBLIC_ORDER_MANAGER");

export {
  configureDelivery,
  deliverDelivery,
  getDelivery,
  listDeliveries,
  pickUpDelivery,
  startDelivery,
};
