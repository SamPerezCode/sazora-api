import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { listKitchenTicketsQuerySchema } from "../schemas/list-kitchen-tickets.schema";
import {
  kitchenTicketItemParamsSchema,
  updateKitchenTicketItemStatusSchema,
} from "../schemas/update-kitchen-ticket-item-status.schema";
import { listKitchenTickets } from "../services/list-kitchen-tickets.service";
import { changeKitchenTicketItemStatus } from "../services/update-kitchen-ticket-item-status.service";

const listKitchenTicketsController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const query = listKitchenTicketsQuerySchema.parse(request.query);

  const kitchenTickets = await listKitchenTickets(
    request.auth.businessId,
    query,
  );

  response.status(200).json({
    status: "success",
    data: {
      kitchenTickets,
    },
  });
};

const updateKitchenTicketItemStatusController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { kitchenTicketId, kitchenTicketItemId } =
    kitchenTicketItemParamsSchema.parse(request.params);

  const input = updateKitchenTicketItemStatusSchema.parse(request.body);

  const result = await changeKitchenTicketItemStatus(
    request.auth.businessId,
    request.auth.membershipId,
    kitchenTicketId,
    kitchenTicketItemId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

export {
  listKitchenTicketsController,
  updateKitchenTicketItemStatusController,
};
