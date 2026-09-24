import type { RequestHandler } from "express";

import { getPublicMenuParamsSchema } from "../schemas/get-public-menu.schema";
import { getPublicMenu } from "../services/get-public-menu.service";

const getPublicMenuController: RequestHandler = async (request, response) => {
  const { businessSlug } = getPublicMenuParamsSchema.parse(request.params);

  const menu = await getPublicMenu(businessSlug);

  response.status(200).json({
    status: "success",
    data: {
      menu,
    },
  });
};

export { getPublicMenuController };
