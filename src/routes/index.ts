import { Router } from "express";

import { authRouter } from "../modules/auth/auth.routes";
import { categoryRouter } from "../modules/categories/category.routes";
import { kitchenTicketRouter } from "../modules/kitchen-tickets/kitchen-ticket.routes";
import { orderRouter } from "../modules/orders/order.routes";
import { preparationAreaRouter } from "../modules/preparation-areas/preparation-area.routes";
import { productRouter } from "../modules/products/product.routes";
import { restaurantTableRouter } from "../modules/restaurant-tables/restaurant-table.routes";
import { healthRouter } from "./health.routes";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/preparation-areas", preparationAreaRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/restaurant-tables", restaurantTableRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use("/kitchen-tickets", kitchenTicketRouter);

export { apiRouter };
