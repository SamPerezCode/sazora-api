import { Router } from "express";

import { authRouter } from "../modules/auth/auth.routes";
import { categoryRouter } from "../modules/categories/category.routes";
import { preparationAreaRouter } from "../modules/preparation-areas/preparation-area.routes";
import { productRouter } from "../modules/products/product.routes";
import { healthRouter } from "./health.routes";
import { restaurantTableRouter } from "../modules/restaurant-tables/restaurant-table.routes";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/preparation-areas", preparationAreaRouter);
apiRouter.use("/products", productRouter);
apiRouter.use("/restaurant-tables", restaurantTableRouter);

export { apiRouter };
