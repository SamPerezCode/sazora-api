import { AppError } from "../../../shared/errors/app-error";
import { findInventoryItemById } from "../../inventory-items/repositories/inventory-item.repository";
import { findProductById } from "../../products/repositories/product.repository";
import type {
  CreateProductInventoryLinkData,
  ProductInventoryLink,
  UpdateProductInventoryLinkData,
} from "../product-inventory-link.types";
import {
  findProductInventoryLinkById,
  findProductInventoryLinks,
  insertProductInventoryLink,
  updateProductInventoryLinkById,
  updateProductInventoryLinkStatusById,
} from "../repositories/product-inventory-link.repository";

const listProductInventoryLinks = async (
  businessId: string,
): Promise<ProductInventoryLink[]> => findProductInventoryLinks(businessId);

const getProductInventoryLink = async (
  businessId: string,
  linkId: string,
): Promise<ProductInventoryLink> => {
  const link = await findProductInventoryLinkById(businessId, linkId);

  if (!link) {
    throw new AppError(
      "La relación producto-inventario no existe",
      404,
      "PRODUCT_INVENTORY_LINK_NOT_FOUND",
    );
  }

  return link;
};

const createProductInventoryLink = async (
  businessId: string,
  data: CreateProductInventoryLinkData,
): Promise<ProductInventoryLink> => {
  const [product, inventoryItem] = await Promise.all([
    findProductById(businessId, data.productId),
    findInventoryItemById(businessId, data.inventoryItemId),
  ]);

  if (product?.isActive !== true) {
    throw new AppError(
      "El producto no existe o está inactivo",
      409,
      "PRODUCT_NOT_AVAILABLE",
    );
  }

  if (inventoryItem?.isActive !== true) {
    throw new AppError(
      "El artículo de inventario no existe o está inactivo",
      409,
      "INVENTORY_ITEM_NOT_AVAILABLE",
    );
  }

  return insertProductInventoryLink(businessId, data);
};

const updateProductInventoryLink = async (
  businessId: string,
  linkId: string,
  data: UpdateProductInventoryLinkData,
): Promise<ProductInventoryLink> => {
  const link = await updateProductInventoryLinkById(businessId, linkId, data);

  if (!link) {
    throw new AppError(
      "La relación producto-inventario no existe",
      404,
      "PRODUCT_INVENTORY_LINK_NOT_FOUND",
    );
  }

  return link;
};

const updateProductInventoryLinkStatus = async (
  businessId: string,
  linkId: string,
  isActive: boolean,
): Promise<ProductInventoryLink> => {
  const link = await updateProductInventoryLinkStatusById(
    businessId,
    linkId,
    isActive,
  );

  if (!link) {
    throw new AppError(
      "La relación producto-inventario no existe",
      404,
      "PRODUCT_INVENTORY_LINK_NOT_FOUND",
    );
  }

  return link;
};

export {
  createProductInventoryLink,
  getProductInventoryLink,
  listProductInventoryLinks,
  updateProductInventoryLink,
  updateProductInventoryLinkStatus,
};
