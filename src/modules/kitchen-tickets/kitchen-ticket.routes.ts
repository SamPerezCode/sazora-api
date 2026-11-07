import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createKitchenTicketPrintController,
  listKitchenTicketPrintsController,
  listKitchenTicketsController,
  reprintKitchenTicketController,
  updateKitchenTicketItemStatusController,
  updateKitchenTicketStatusController,
} from "./controllers/kitchen-ticket.controller";

const kitchenTicketRouter = Router();

kitchenTicketRouter.get(
  "/",
  authenticate,
  authorizePermissions("kitchen.tickets.read"),
  listKitchenTicketsController,
);

kitchenTicketRouter.get(
  "/:kitchenTicketId/prints",
  authenticate,
  authorizePermissions("kitchen.tickets.read"),
  listKitchenTicketPrintsController,
);

kitchenTicketRouter.post(
  "/:kitchenTicketId/prints",
  authenticate,
  authorizePermissions("kitchen.tickets.print"),
  createKitchenTicketPrintController,
);

kitchenTicketRouter.post(
  "/:kitchenTicketId/prints/:kitchenTicketPrintId/reprint",
  authenticate,
  authorizePermissions("kitchen.tickets.print"),
  reprintKitchenTicketController,
);

kitchenTicketRouter.patch(
  "/:kitchenTicketId/status",
  authenticate,
  authorizePermissions("kitchen.tickets.update"),
  updateKitchenTicketStatusController,
);

kitchenTicketRouter.patch(
  "/:kitchenTicketId/items/:kitchenTicketItemId/status",
  authenticate,
  authorizePermissions("kitchen.tickets.update"),
  updateKitchenTicketItemStatusController,
);

export { kitchenTicketRouter };
