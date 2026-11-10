type InventoryReservationStatus =
  "ACTIVE" | "CONSUMED" | "RELEASED" | "EXPIRED";

interface InventoryReservation {
  id: string;
  businessId: string;
  locationId: string;
  orderId: string;
  orderItemId: string;
  inventoryItemId: string;
  quantity: string;
  status: InventoryReservationStatus;
  expiresAt: Date | null;
  reservedAt: Date;
  consumedAt: Date | null;
  releasedAt: Date | null;
  releaseReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ReserveOrderItemInventoryData {
  locationId: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  orderQuantity: number;
  expiresAt: Date | null;
}

type ReserveOrderItemInventoryResult =
  | Readonly<{
      kind: "RESERVED";
      reservations: readonly InventoryReservation[];
    }>
  | Readonly<{
      kind: "INVENTORY_ITEM_UNAVAILABLE";
      inventoryItemId: string;
      inventoryItemName: string;
    }>
  | Readonly<{
      kind: "INSUFFICIENT_AVAILABLE_STOCK";
      inventoryItemId: string;
      inventoryItemName: string;
      currentStock: string;
      reservedQuantity: string;
      availableQuantity: string;
      requestedQuantity: string;
    }>
  | Readonly<{
      kind: "RESERVATION_ALREADY_CONSUMED";
      inventoryItemId: string;
    }>;

export type {
  InventoryReservation,
  InventoryReservationStatus,
  ReserveOrderItemInventoryData,
  ReserveOrderItemInventoryResult,
};
