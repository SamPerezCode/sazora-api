import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
import {
  listKitchenTicketsController,
  updateKitchenTicketItemStatusController,
} from "./controllers/kitchen-ticket.controller";

const kitchenTicketRouter = Router();

kitchenTicketRouter.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "KITCHEN"),
  listKitchenTicketsController,
);

kitchenTicketRouter.patch(
  "/:kitchenTicketId/items/:kitchenTicketItemId/status",
  authenticate,
  authorizeRoles("ADMIN", "KITCHEN", "WAITER"),
  updateKitchenTicketItemStatusController,
);

export { kitchenTicketRouter };
