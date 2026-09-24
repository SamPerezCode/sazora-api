import { Router } from "express";

import { getPublicMenuController } from "./controllers/public-menu.controller";

const publicMenuRouter = Router();

publicMenuRouter.get("/:businessSlug/menu", getPublicMenuController);

export { publicMenuRouter };
