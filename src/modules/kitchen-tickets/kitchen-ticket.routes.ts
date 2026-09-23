import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
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
  authorizeRoles("ADMIN", "KITCHEN"),
  listKitchenTicketsController,
);

kitchenTicketRouter.get(
  "/:kitchenTicketId/prints",
  authenticate,
  authorizeRoles("ADMIN", "KITCHEN"),
  listKitchenTicketPrintsController,
);

kitchenTicketRouter.post(
  "/:kitchenTicketId/prints",
  authenticate,
  authorizeRoles("ADMIN", "KITCHEN"),
  createKitchenTicketPrintController,
);

kitchenTicketRouter.post(
  "/:kitchenTicketId/prints/:kitchenTicketPrintId/reprint",
  authenticate,
  authorizeRoles("ADMIN", "KITCHEN"),
  reprintKitchenTicketController,
);

kitchenTicketRouter.patch(
  "/:kitchenTicketId/status",
  authenticate,
  authorizeRoles("ADMIN", "KITCHEN", "WAITER"),
  updateKitchenTicketStatusController,
);

kitchenTicketRouter.patch(
  "/:kitchenTicketId/items/:kitchenTicketItemId/status",
  authenticate,
  authorizeRoles("ADMIN", "KITCHEN", "WAITER"),
  updateKitchenTicketItemStatusController,
);

export { kitchenTicketRouter };
