import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createTaxClassController,
  createTaxRateController,
  getTaxClassController,
  listTaxClassesController,
  updateTaxClassController,
  updateTaxClassStatusController,
} from "./controllers/tax-class.controller";

const taxClassRouter = Router();

taxClassRouter.get(
  "/",
  authenticate,
  authorizePermissions("taxes.read"),
  listTaxClassesController,
);

taxClassRouter.get(
  "/:taxClassId",
  authenticate,
  authorizePermissions("taxes.read"),
  getTaxClassController,
);

taxClassRouter.post(
  "/",
  authenticate,
  authorizePermissions("taxes.manage"),
  createTaxClassController,
);

taxClassRouter.post(
  "/:taxClassId/rates",
  authenticate,
  authorizePermissions("taxes.manage"),
  createTaxRateController,
);

taxClassRouter.patch(
  "/:taxClassId/status",
  authenticate,
  authorizePermissions("taxes.manage"),
  updateTaxClassStatusController,
);

taxClassRouter.patch(
  "/:taxClassId",
  authenticate,
  authorizePermissions("taxes.manage"),
  updateTaxClassController,
);

export { taxClassRouter };
