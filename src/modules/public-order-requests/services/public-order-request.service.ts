import { AppError } from "../../../shared/errors/app-error";
import { emitPublicOrderRequestCreated } from "../../../realtime/realtime.events";
import type {
  CreatePublicOrderRequestData,
  PublicOrderRequest,
  PublicOrderRequestListItem,
} from "../public-order-request.types";
import {
  createPublicOrderRequestRecord,
  findEffectiveAssignmentRecipients,
  findPublicOrderRequestById,
  findPublicOrderRequestsByBusinessId,
} from "../repositories/public-order-request.repository";

const getLocalScheduleParts = (
  timezone: string,
  date: Date,
): Readonly<{
  localDate: string;
  localDayOfWeek: number;
  localTime: string;
}> => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  const dayByName: Readonly<Record<string, number>> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const weekday = parts.weekday;
  const localDayOfWeek = weekday ? dayByName[weekday] : undefined;

  if (
    !parts.year ||
    !parts.month ||
    !parts.day ||
    !parts.hour ||
    !parts.minute ||
    localDayOfWeek === undefined
  ) {
    throw new Error("No fue posible calcular el horario local del negocio");
  }

  return {
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    localDayOfWeek,
    localTime: `${parts.hour}:${parts.minute}`,
  };
};

const createPublicOrderRequest = async (
  businessSlug: string,
  data: CreatePublicOrderRequestData,
): Promise<PublicOrderRequest> => {
  const result = await createPublicOrderRequestRecord(businessSlug, data);

  if (result.kind === "BUSINESS_NOT_AVAILABLE") {
    throw new AppError(
      "El negocio no está recibiendo pedidos públicos",
      404,
      "PUBLIC_ORDERING_NOT_AVAILABLE",
    );
  }

  if (result.kind === "PRODUCTS_NOT_AVAILABLE") {
    throw new AppError(
      `Algunos productos ya no están disponibles: ${result.productIds.join(", ")}`,
      409,
      "PUBLIC_PRODUCTS_NOT_AVAILABLE",
    );
  }

  const schedule = getLocalScheduleParts(result.timezone, new Date());

  const recipients = await findEffectiveAssignmentRecipients(
    result.request.businessId,
    result.request.serviceType,
    schedule.localDate,
    schedule.localDayOfWeek,
    schedule.localTime,
  );

  try {
    emitPublicOrderRequestCreated({
      businessId: result.request.businessId,
      requestId: result.request.id,
      publicCode: result.request.publicCode,
      serviceType: result.request.serviceType,
      customerName: result.request.customerName,
      customerPhone: result.request.customerPhone,
      itemCount: result.request.items.length,
      subtotal: result.request.subtotal,
      createdAt: result.request.createdAt.toISOString(),
      recipientMembershipIds: recipients.map(
        (recipient) => recipient.membershipId,
      ),
    });
  } catch (error) {
    console.error("No fue posible emitir la nueva solicitud pública", error);
  }

  return result.request;
};

const listPublicOrderRequests = async (
  businessId: string,
): Promise<PublicOrderRequestListItem[]> =>
  findPublicOrderRequestsByBusinessId(businessId);

const getPublicOrderRequest = async (
  businessId: string,
  requestId: string,
): Promise<PublicOrderRequest> => {
  const request = await findPublicOrderRequestById(businessId, requestId);

  if (!request) {
    throw new AppError(
      "La solicitud pública no existe",
      404,
      "PUBLIC_ORDER_REQUEST_NOT_FOUND",
    );
  }

  return request;
};

export {
  createPublicOrderRequest,
  getPublicOrderRequest,
  listPublicOrderRequests,
};
