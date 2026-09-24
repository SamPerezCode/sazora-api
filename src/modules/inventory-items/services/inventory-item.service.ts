import { AppError } from "../../../shared/errors/app-error";
import type {
  CreateInventoryItemData,
  InventoryItem,
  UpdateInventoryItemData,
} from "../inventory-item.types";
import {
  findInventoryItemById,
  findInventoryItems,
  insertInventoryItem,
  updateInventoryItemById,
  updateInventoryItemStatusById,
} from "../repositories/inventory-item.repository";

const listInventoryItems = async (
  businessId: string,
): Promise<InventoryItem[]> => findInventoryItems(businessId);

const getInventoryItem = async (
  businessId: string,
  inventoryItemId: string,
): Promise<InventoryItem> => {
  const item = await findInventoryItemById(businessId, inventoryItemId);

  if (!item) {
    throw new AppError(
      "El artículo de inventario no existe",
      404,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }

  return item;
};

const createInventoryItem = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryItemData,
): Promise<InventoryItem> =>
  insertInventoryItem(businessId, membershipId, data);

const updateInventoryItem = async (
  businessId: string,
  inventoryItemId: string,
  data: UpdateInventoryItemData,
): Promise<InventoryItem> => {
  const item = await updateInventoryItemById(businessId, inventoryItemId, data);

  if (!item) {
    throw new AppError(
      "El artículo de inventario no existe",
      404,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }

  return item;
};

const updateInventoryItemStatus = async (
  businessId: string,
  inventoryItemId: string,
  isActive: boolean,
): Promise<InventoryItem> => {
  const item = await updateInventoryItemStatusById(
    businessId,
    inventoryItemId,
    isActive,
  );

  if (!item) {
    throw new AppError(
      "El artículo de inventario no existe",
      404,
      "INVENTORY_ITEM_NOT_FOUND",
    );
  }

  return item;
};

export {
  createInventoryItem,
  getInventoryItem,
  listInventoryItems,
  updateInventoryItem,
  updateInventoryItemStatus,
};
