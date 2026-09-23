import { AppError } from "../../../shared/errors/app-error";
import type { KitchenTicketPrint } from "../kitchen-ticket-print.types";
import {
  createKitchenTicketPrint,
  listKitchenTicketPrints,
  reprintKitchenTicket,
} from "../repositories/kitchen-ticket-print.repository";
import type {
  CreateKitchenTicketPrintInput,
  ReprintKitchenTicketInput,
} from "../schemas/kitchen-ticket-print.schema";

const registerKitchenTicketPrint = async (
  businessId: string,
  membershipId: string,
  kitchenTicketId: string,
  input: CreateKitchenTicketPrintInput,
): Promise<KitchenTicketPrint> => {
  const result = await createKitchenTicketPrint(
    businessId,
    membershipId,
    kitchenTicketId,
    input,
  );

  switch (result.kind) {
    case "CREATED":
      return result.print;

    case "TICKET_NOT_FOUND":
      throw new AppError(
        "La comanda no existe en este negocio",
        404,
        "KITCHEN_TICKET_NOT_FOUND",
      );

    case "ORDER_NOT_CONFIRMED":
      throw new AppError(
        "Solo se puede imprimir la versión actual de una orden confirmada",
        409,
        "ORDER_NOT_CONFIRMED",
      );

    case "REASON_REQUIRED":
      throw new AppError(
        "Debes indicar el motivo de la impresión modificada",
        400,
        "KITCHEN_TICKET_PRINT_REASON_REQUIRED",
      );

    case "VERSION_ALREADY_PRINTED":
      throw new AppError(
        "Esta versión de la comanda ya fue impresa; utiliza el endpoint de reimpresión",
        409,
        "KITCHEN_TICKET_VERSION_ALREADY_PRINTED",
      );
  }
};

const getKitchenTicketPrints = async (
  businessId: string,
  kitchenTicketId: string,
): Promise<readonly KitchenTicketPrint[]> => {
  const result = await listKitchenTicketPrints(businessId, kitchenTicketId);

  switch (result.kind) {
    case "FOUND":
      return result.prints;

    case "TICKET_NOT_FOUND":
      throw new AppError(
        "La comanda no existe en este negocio",
        404,
        "KITCHEN_TICKET_NOT_FOUND",
      );
  }
};

const registerKitchenTicketReprint = async (
  businessId: string,
  membershipId: string,
  kitchenTicketId: string,
  kitchenTicketPrintId: string,
  input: ReprintKitchenTicketInput,
): Promise<KitchenTicketPrint> => {
  const result = await reprintKitchenTicket(
    businessId,
    membershipId,
    kitchenTicketId,
    kitchenTicketPrintId,
    input,
  );

  switch (result.kind) {
    case "CREATED":
      return result.print;

    case "PRINT_NOT_FOUND":
      throw new AppError(
        "La impresión original no existe para esta comanda",
        404,
        "KITCHEN_TICKET_PRINT_NOT_FOUND",
      );
  }
};

export {
  getKitchenTicketPrints,
  registerKitchenTicketPrint,
  registerKitchenTicketReprint,
};
