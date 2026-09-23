import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  createKitchenTicketPrintSchema,
  kitchenTicketPrintParamsSchema,
  kitchenTicketReprintParamsSchema,
  reprintKitchenTicketSchema,
} from "../schemas/kitchen-ticket-print.schema";
import { listKitchenTicketsQuerySchema } from "../schemas/list-kitchen-tickets.schema";
import {
  updateKitchenTicketStatusParamsSchema,
  updateKitchenTicketStatusSchema,
} from "../schemas/update-kitchen-ticket-status.schema";
import {
  kitchenTicketItemParamsSchema,
  updateKitchenTicketItemStatusSchema,
} from "../schemas/update-kitchen-ticket-item-status.schema";
import {
  getKitchenTicketPrints,
  registerKitchenTicketPrint,
  registerKitchenTicketReprint,
} from "../services/kitchen-ticket-print.service";
import { listKitchenTickets } from "../services/list-kitchen-tickets.service";
import { changeKitchenTicketStatus } from "../services/update-kitchen-ticket-status.service";
import { changeKitchenTicketItemStatus } from "../services/update-kitchen-ticket-item-status.service";

const requireAuthentication = (
  request: Parameters<RequestHandler>[0],
): NonNullable<Parameters<RequestHandler>[0]["auth"]> => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  return request.auth;
};

const listKitchenTicketsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuthentication(request);
  const query = listKitchenTicketsQuerySchema.parse(request.query);

  const kitchenTickets = await listKitchenTickets(auth.businessId, query);

  response.status(200).json({
    status: "success",
    data: {
      kitchenTickets,
    },
  });
};

const createKitchenTicketPrintController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuthentication(request);

  const { kitchenTicketId } = kitchenTicketPrintParamsSchema.parse(
    request.params,
  );

  const input = createKitchenTicketPrintSchema.parse(request.body);

  const print = await registerKitchenTicketPrint(
    auth.businessId,
    auth.membershipId,
    kitchenTicketId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      print,
    },
  });
};

const listKitchenTicketPrintsController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuthentication(request);

  const { kitchenTicketId } = kitchenTicketPrintParamsSchema.parse(
    request.params,
  );

  const prints = await getKitchenTicketPrints(auth.businessId, kitchenTicketId);

  response.status(200).json({
    status: "success",
    data: {
      prints,
    },
  });
};

const reprintKitchenTicketController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuthentication(request);

  const { kitchenTicketId, kitchenTicketPrintId } =
    kitchenTicketReprintParamsSchema.parse(request.params);

  const input = reprintKitchenTicketSchema.parse(request.body);

  const print = await registerKitchenTicketReprint(
    auth.businessId,
    auth.membershipId,
    kitchenTicketId,
    kitchenTicketPrintId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      print,
    },
  });
};

const updateKitchenTicketStatusController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuthentication(request);

  const { kitchenTicketId } = updateKitchenTicketStatusParamsSchema.parse(
    request.params,
  );

  const input = updateKitchenTicketStatusSchema.parse(request.body);

  const result = await changeKitchenTicketStatus(
    auth.businessId,
    auth.membershipId,
    kitchenTicketId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: result,
  });
};

const updateKitchenTicketItemStatusController: RequestHandler = async (
  request,
  response,
) => {
  const auth = requireAuthentication(request);

  const { kitchenTicketId, kitchenTicketItemId } =
    kitchenTicketItemParamsSchema.parse(request.params);

  const input = updateKitchenTicketItemStatusSchema.parse(request.body);

  const result = await changeKitchenTicketItemStatus(
    auth.businessId,
    auth.membershipId,
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
  createKitchenTicketPrintController,
  listKitchenTicketPrintsController,
  listKitchenTicketsController,
  reprintKitchenTicketController,
  updateKitchenTicketItemStatusController,
  updateKitchenTicketStatusController,
};
