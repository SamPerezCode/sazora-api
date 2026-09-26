import { Router } from "express";

import { authRouter } from "../modules/auth/auth.routes";
import { businessSettingsRouter } from "../modules/business-settings/business-settings.routes";
import { categoryRouter } from "../modules/categories/category.routes";
import { employeeRouter } from "../modules/employees/employee.routes";
import { kitchenTicketRouter } from "../modules/kitchen-tickets/kitchen-ticket.routes";
import { orderRouter } from "../modules/orders/order.routes";
import { preparationAreaRouter } from "../modules/preparation-areas/preparation-area.routes";
import { productRouter } from "../modules/products/product.routes";
import { restaurantTableRouter } from "../modules/restaurant-tables/restaurant-table.routes";
import { healthRouter } from "./health.routes";
import { publicMenuRouter } from "../modules/public-menu/public-menu.routes";
import { publicOrderAssignmentRouter } from "../modules/public-order-assignments/public-order-assignment.routes";
import { publicMenuSettingsRouter } from "../modules/public-menu-settings/public-menu-settings.routes";
import { deliveryRouter } from "../modules/deliveries/delivery.routes";
import { inventoryItemRouter } from "../modules/inventory-items/inventory-item.routes";
import { inventoryMovementRouter } from "../modules/inventory-movements/inventory-movement.routes";
import { productionRouter } from "../modules/production/production.routes";
import { productInventoryLinkRouter } from "../modules/product-inventory-links/product-inventory-link.routes";
import { dashboardRouter } from "../modules/dashboard/dashboard.routes";

import {
  publicOrderRequestRouter,
  publicOrderSubmissionRouter,
} from "../modules/public-order-requests/public-order-request.routes";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/public/businesses", publicMenuRouter);
apiRouter.use("/business-settings", businessSettingsRouter);
apiRouter.use("/employees", employeeRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/preparation-areas", preparationAreaRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/restaurant-tables", restaurantTableRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/kitchen-tickets", kitchenTicketRouter);
apiRouter.use("/public-order-assignments", publicOrderAssignmentRouter);
apiRouter.use("/public-menu-settings", publicMenuSettingsRouter);
apiRouter.use("/public/businesses", publicOrderSubmissionRouter);
apiRouter.use("/public-order-requests", publicOrderRequestRouter);
apiRouter.use("/deliveries", deliveryRouter);
apiRouter.use("/inventory-items", inventoryItemRouter);
apiRouter.use("/inventory-movements", inventoryMovementRouter);
apiRouter.use("/production", productionRouter);
apiRouter.use("/product-inventory-links", productInventoryLinkRouter);

export { apiRouter };
