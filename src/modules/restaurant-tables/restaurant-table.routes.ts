import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizePermissions } from "../auth/middlewares/authorize-permissions.middleware";
import {
  createRestaurantTableController,
  getRestaurantTableController,
  listRestaurantTablesController,
  updateRestaurantTableController,
  updateRestaurantTableStatusController,
} from "./controllers/restaurant-table.controller";

const restaurantTableRouter = Router();

restaurantTableRouter.get(
  "/",
  authenticate,
  authorizePermissions("tables.read"),
  listRestaurantTablesController,
);

restaurantTableRouter.get(
  "/:restaurantTableId",
  authenticate,
  authorizePermissions("tables.read"),
  getRestaurantTableController,
);

restaurantTableRouter.post(
  "/",
  authenticate,
  authorizePermissions("tables.manage"),
  createRestaurantTableController,
);

restaurantTableRouter.patch(
  "/:restaurantTableId/status",
  authenticate,
  authorizePermissions("tables.manage"),
  updateRestaurantTableStatusController,
);

restaurantTableRouter.patch(
  "/:restaurantTableId",
  authenticate,
  authorizePermissions("tables.manage"),
  updateRestaurantTableController,
);

export { restaurantTableRouter };
