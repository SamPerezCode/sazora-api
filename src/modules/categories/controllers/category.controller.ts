import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import { createCategorySchema } from "../schemas/create-category.schema";
import { updateCategoryStatusSchema } from "../schemas/update-category-status.schema";
import {
  categoryIdParamsSchema,
  updateCategorySchema,
} from "../schemas/update-category.schema";
import { createCategory } from "../services/create-category.service";
import { listCategories } from "../services/list-categories.service";
import { updateCategory } from "../services/update-category.service";
import { changeCategoryStatus } from "../services/update-category-status.service";

const createCategoryController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const input = createCategorySchema.parse(request.body);

  const category = await createCategory(request.auth.businessId, input);

  response.status(201).json({
    status: "success",
    data: {
      category,
    },
  });
};

const listCategoriesController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const categories = await listCategories(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      categories,
    },
  });
};

const updateCategoryController: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { categoryId } = categoryIdParamsSchema.parse(request.params);

  const input = updateCategorySchema.parse(request.body);

  const category = await updateCategory(
    request.auth.businessId,
    categoryId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      category,
    },
  });
};

const updateCategoryStatusController: RequestHandler = async (
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

  const { categoryId } = categoryIdParamsSchema.parse(request.params);

  const input = updateCategoryStatusSchema.parse(request.body);

  const category = await changeCategoryStatus(
    request.auth.businessId,
    categoryId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      category,
    },
  });
};

export {
  createCategoryController,
  listCategoriesController,
  updateCategoryController,
  updateCategoryStatusController,
};
