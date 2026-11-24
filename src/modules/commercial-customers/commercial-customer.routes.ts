import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  getCommercialCustomerController,
  getCommercialCustomerOrdersController,
  getCommercialCustomerSalesController,
  listCommercialCustomersController,
  updateCommercialCustomerConsentController,
  updateCommercialCustomerStatusController,
} from "./controllers/commercial-customer.controller";

const commercialCustomerRouter = Router();

commercialCustomerRouter.get(
  "/",
  authenticate,
  authorizePermissions("customers.read"),
  listCommercialCustomersController,
);

commercialCustomerRouter.get(
  "/:customerId/orders",
  authenticate,
  authorizePermissions("customers.read"),
  getCommercialCustomerOrdersController,
);

commercialCustomerRouter.get(
  "/:customerId/sales",
  authenticate,
  authorizePermissions("customers.read"),
  getCommercialCustomerSalesController,
);

commercialCustomerRouter.patch(
  "/:customerId/marketing-consent",
  authenticate,
  authorizePermissions("customers.manage"),
  updateCommercialCustomerConsentController,
);

commercialCustomerRouter.patch(
  "/:customerId/status",
  authenticate,
  authorizePermissions("customers.manage"),
  updateCommercialCustomerStatusController,
);

commercialCustomerRouter.get(
  "/:customerId",
  authenticate,
  authorizePermissions("customers.read"),
  getCommercialCustomerController,
);

export { commercialCustomerRouter };
