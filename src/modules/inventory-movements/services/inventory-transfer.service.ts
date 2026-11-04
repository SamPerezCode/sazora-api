import type {
  CreateInventoryTransferData,
  InventoryTransfer,
} from "../inventory-transfer.types";

import { createInventoryTransferRecord } from "../repositories/inventory-transfer.repository";

const createInventoryTransfer = async (
  businessId: string,
  membershipId: string,
  data: CreateInventoryTransferData,
): Promise<InventoryTransfer> =>
  createInventoryTransferRecord(businessId, membershipId, data);

export { createInventoryTransfer };
