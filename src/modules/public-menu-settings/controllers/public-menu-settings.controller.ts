import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  publicCategoryIdParamsSchema,
  publicProductIdParamsSchema,
  updatePublicCategoryVisibilitySchema,
  updatePublicProductSettingsSchema,
} from "../schemas/public-menu-settings.schema";
import {
  changeCategoryPublicVisibility,
  changeProductPublicSettings,
  getPublicMenuSettingsCatalog,
} from "../services/public-menu-settings.service";

const getPublicMenuSettingsCatalogController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const catalog = await getPublicMenuSettingsCatalog(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      catalog,
    },
  });
};

const updatePublicCategoryVisibilityController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { categoryId } = publicCategoryIdParamsSchema.parse(request.params);

  const { isPubliclyVisible } = updatePublicCategoryVisibilitySchema.parse(
    request.body,
  );

  const category = await changeCategoryPublicVisibility(
    request.auth.businessId,
    categoryId,
    isPubliclyVisible,
  );

  response.status(200).json({
    status: "success",
    data: {
      category,
    },
  });
};

const updatePublicProductSettingsController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { productId } = publicProductIdParamsSchema.parse(request.params);

  const { isPubliclyVisible, isPubliclyOrderable } =
    updatePublicProductSettingsSchema.parse(request.body);

  const product = await changeProductPublicSettings(
    request.auth.businessId,
    productId,
    isPubliclyVisible,
    isPubliclyOrderable,
  );

  response.status(200).json({
    status: "success",
    data: {
      product,
    },
  });
};

export {
  getPublicMenuSettingsCatalogController,
  updatePublicCategoryVisibilityController,
  updatePublicProductSettingsController,
};
