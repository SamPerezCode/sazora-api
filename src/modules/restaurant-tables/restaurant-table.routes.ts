import { Router } from "express";

import { authenticate } from "../auth/middlewares/authenticate.middleware";
import { authorizeRoles } from "../auth/middlewares/authorize-roles.middleware";
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
  authorizeRoles("ADMIN"),
  listRestaurantTablesController,
);

restaurantTableRouter.get(
  "/:restaurantTableId",
  authenticate,
  authorizeRoles("ADMIN"),
  getRestaurantTableController,
);

restaurantTableRouter.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createRestaurantTableController,
);

restaurantTableRouter.patch(
  "/:restaurantTableId/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateRestaurantTableStatusController,
);

restaurantTableRouter.patch(
  "/:restaurantTableId",
  authenticate,
  authorizeRoles("ADMIN"),
  updateRestaurantTableController,
);

export { restaurantTableRouter };
