import { Router } from "express";

import { authRouter } from "../modules/auth/auth.routes";
import { healthRouter } from "./health.routes";
import { categoryRouter } from "../modules/categories/category.routes";
import { preparationAreaRouter } from "../modules/preparation-areas/preparation-area.routes";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/preparation-areas", preparationAreaRouter);

export { apiRouter };
