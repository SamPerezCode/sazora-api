import { randomUUID } from "node:crypto";

import {
  getBusinessRoleRoom,
  getLocationRoleRoom,
  getMembershipRoom,
} from "./realtime.rooms";
import { getRealtimeServer } from "./realtime.server";
import {
  findOrderRealtimeContext,
  type OrderRealtimeContext,
} from "../modules/orders/repositories/order-location.repository";
import type {
  KitchenTicketItemStatusUpdatedPayload,
  OrderConfirmedPayload,
  OrderCreatedPayload,
  OrderItemCancelledPayload,
  OrderItemQuantityCancelledPayload,
  OrderItemRemovedPayload,
  OrderItemsAddedPayload,
  OrderItemUpdatedPayload,
  OrderStatusUpdatedPayload,
  OrderUpdatedPayload,
  PublicOrderRequestCreatedPayload,
  PublicOrderRequestStatusUpdatedPayload,
  PublicOrderRequestOrderConfirmedPayload,
  PublicOrderRequestPreparationUpdatedPayload,
  PublicOrderRequestOrderClosedPayload,
  DeliveryStatusUpdatedPayload,
  InventoryChangedPayload,
} from "./realtime.types";

const emitSafely = (eventName: string, operation: () => void): void => {
  try {
    operation();
  } catch (error) {
    // Los eventos son notificaciones posteriores al commit. Nunca deben
    // convertir una escritura confirmada en un error reintentable por HTTP.
    console.error(`No fue posible emitir ${eventName}`, error);
  }
};

type LocationScopedInput<T extends { locationId: string }> = Omit<
  T,
  "locationId"
>;

const runWithOrderContext = (
  eventName: string,
  businessId: string,
  orderId: string,
  operation: (context: OrderRealtimeContext) => void,
): void => {
  void findOrderRealtimeContext(businessId, orderId)
    .then((context) => {
      if (!context) {
        console.error(
          `No fue posible emitir ${eventName}: la orden ${orderId} no existe`,
        );

        return;
      }

      emitSafely(eventName, () => {
        operation(context);
      });
    })
    .catch((error: unknown) => {
      console.error(
        `No fue posible resolver la ubicación para ${eventName}`,
        error,
      );
    });
};

const getLocationEditingRooms = (
  businessId: string,
  locationId: string,
): string[] => [
  getBusinessRoleRoom(businessId, "ADMIN"),
  getLocationRoleRoom(businessId, locationId, "WAITER"),
];

const getLocationOperationalRooms = (
  businessId: string,
  locationId: string,
  kitchenWorkflowMode: "PRINT_ONLY" | "PRINT_AND_SCREEN" | null,
): string[] => {
  const rooms = [
    getBusinessRoleRoom(businessId, "ADMIN"),

    getLocationRoleRoom(businessId, locationId, "WAITER"),
  ];

  if (kitchenWorkflowMode === "PRINT_AND_SCREEN") {
    rooms.push(getLocationRoleRoom(businessId, locationId, "KITCHEN"));
  }

  return rooms;
};

const emitInventoryChanged = (businessId: string): void => {
  const payload: InventoryChangedPayload = {
    eventId: randomUUID(),
    businessId,
    occurredAt: new Date().toISOString(),
  };

  emitSafely("inventory:changed", () => {
    getRealtimeServer()
      .to(getBusinessRoleRoom(businessId, "ADMIN"))
      .emit("inventory:changed", payload);
  });
};

const emitOrderCreated = (
  payload: LocationScopedInput<OrderCreatedPayload>,
): void => {
  runWithOrderContext(
    "order:created",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: OrderCreatedPayload = {
        ...payload,
        locationId: context.locationId,
      };

      getRealtimeServer()
        .to(getLocationEditingRooms(payload.businessId, context.locationId))
        .emit("order:created", eventPayload);
    },
  );
};

const emitOrderConfirmed = (
  payload: LocationScopedInput<OrderConfirmedPayload>,
): void => {
  runWithOrderContext(
    "order:confirmed",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: OrderConfirmedPayload = {
        ...payload,
        locationId: context.locationId,
      };

      getRealtimeServer()
        .to(
          getLocationOperationalRooms(
            payload.businessId,
            context.locationId,
            context.kitchenWorkflowMode,
          ),
        )
        .emit("order:confirmed", eventPayload);
    },
  );
};

const emitKitchenTicketItemStatusUpdated = (
  payload: LocationScopedInput<KitchenTicketItemStatusUpdatedPayload>,
): void => {
  runWithOrderContext(
    "kitchen-ticket:item-status-updated",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: KitchenTicketItemStatusUpdatedPayload = {
        ...payload,
        locationId: context.locationId,
      };

      getRealtimeServer()
        .to(
          getLocationOperationalRooms(
            payload.businessId,
            context.locationId,
            context.kitchenWorkflowMode,
          ),
        )
        .emit("kitchen-ticket:item-status-updated", eventPayload);
    },
  );
};

const emitOrderStatusUpdated = (
  payload: LocationScopedInput<OrderStatusUpdatedPayload>,
): void => {
  runWithOrderContext(
    "order:status-updated",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: OrderStatusUpdatedPayload = {
        ...payload,
        locationId: context.locationId,
      };

      getRealtimeServer()
        .to(
          getLocationOperationalRooms(
            payload.businessId,
            context.locationId,
            context.kitchenWorkflowMode,
          ),
        )
        .emit("order:status-updated", eventPayload);
    },
  );
};

const emitOrderItemsAdded = (
  payload: LocationScopedInput<OrderItemsAddedPayload>,
): void => {
  runWithOrderContext(
    "order:items-added",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: OrderItemsAddedPayload = {
        ...payload,
        locationId: context.locationId,
      };

      const rooms =
        payload.orderStatus === "CONFIRMED"
          ? getLocationOperationalRooms(
              payload.businessId,
              context.locationId,
              context.kitchenWorkflowMode,
            )
          : getLocationEditingRooms(payload.businessId, context.locationId);

      getRealtimeServer().to(rooms).emit("order:items-added", eventPayload);
    },
  );
};
const emitOrderItemUpdated = (
  payload: LocationScopedInput<OrderItemUpdatedPayload>,
): void => {
  runWithOrderContext(
    "order:item-updated",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: OrderItemUpdatedPayload = {
        ...payload,
        locationId: context.locationId,
      };

      getRealtimeServer()
        .to(getLocationEditingRooms(payload.businessId, context.locationId))
        .emit("order:item-updated", eventPayload);
    },
  );
};

const emitOrderItemRemoved = (
  payload: LocationScopedInput<OrderItemRemovedPayload>,
): void => {
  runWithOrderContext(
    "order:item-removed",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: OrderItemRemovedPayload = {
        ...payload,
        locationId: context.locationId,
      };

      getRealtimeServer()
        .to(getLocationEditingRooms(payload.businessId, context.locationId))
        .emit("order:item-removed", eventPayload);
    },
  );
};

const emitOrderItemCancelled = (
  payload: LocationScopedInput<OrderItemCancelledPayload>,
): void => {
  runWithOrderContext(
    "order:item-cancelled",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: OrderItemCancelledPayload = {
        ...payload,
        locationId: context.locationId,
      };

      getRealtimeServer()
        .to(
          getLocationOperationalRooms(
            payload.businessId,
            context.locationId,
            context.kitchenWorkflowMode,
          ),
        )
        .emit("order:item-cancelled", eventPayload);
    },
  );
};

const emitOrderItemQuantityCancelled = (
  payload: LocationScopedInput<OrderItemQuantityCancelledPayload>,
): void => {
  runWithOrderContext(
    "order:item-quantity-cancelled",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: OrderItemQuantityCancelledPayload = {
        ...payload,
        locationId: context.locationId,
      };

      getRealtimeServer()
        .to(
          getLocationOperationalRooms(
            payload.businessId,
            context.locationId,
            context.kitchenWorkflowMode,
          ),
        )
        .emit("order:item-quantity-cancelled", eventPayload);
    },
  );
};

const emitOrderUpdated = (
  payload: LocationScopedInput<OrderUpdatedPayload>,
): void => {
  runWithOrderContext(
    "order:updated",
    payload.businessId,
    payload.orderId,
    (context) => {
      const eventPayload: OrderUpdatedPayload = {
        ...payload,
        locationId: context.locationId,
      };

      getRealtimeServer()
        .to(getLocationEditingRooms(payload.businessId, context.locationId))
        .emit("order:updated", eventPayload);
    },
  );
};

const emitPublicOrderRequestCreated = (
  payload: PublicOrderRequestCreatedPayload,
): void => {
  const recipientRooms =
    payload.recipientMembershipIds.length > 0
      ? payload.recipientMembershipIds.map(getMembershipRoom)
      : [getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER")];

  const rooms = [
    getBusinessRoleRoom(payload.businessId, "ADMIN"),
    ...recipientRooms,
  ];

  getRealtimeServer()
    .to([...new Set(rooms)])
    .emit("public-order-request:created", payload);
};

const emitPublicOrderRequestStatusUpdated = (
  payload: PublicOrderRequestStatusUpdatedPayload,
): void => {
  getRealtimeServer()
    .to([
      getBusinessRoleRoom(payload.businessId, "ADMIN"),
      getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
    ])
    .emit("public-order-request:status-updated", payload);
};

const emitPublicOrderRequestOrderConfirmed = (
  payload: PublicOrderRequestOrderConfirmedPayload,
): void => {
  getRealtimeServer()
    .to([
      getBusinessRoleRoom(payload.businessId, "ADMIN"),
      getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
    ])
    .emit("public-order-request:order-confirmed", payload);
};

const emitPublicOrderRequestPreparationUpdated = (
  payload: PublicOrderRequestPreparationUpdatedPayload,
): void => {
  getRealtimeServer()
    .to([
      getBusinessRoleRoom(payload.businessId, "ADMIN"),
      getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
    ])
    .emit("public-order-request:preparation-updated", payload);
};

const emitPublicOrderRequestOrderClosed = (
  payload: PublicOrderRequestOrderClosedPayload,
): void => {
  getRealtimeServer()
    .to([
      getBusinessRoleRoom(payload.businessId, "ADMIN"),
      getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
    ])
    .emit("public-order-request:order-closed", payload);
};

const emitDeliveryStatusUpdated = (
  payload: DeliveryStatusUpdatedPayload,
): void => {
  const rooms = [
    getBusinessRoleRoom(payload.businessId, "ADMIN"),
    getBusinessRoleRoom(payload.businessId, "PUBLIC_ORDER_MANAGER"),
  ];

  if (payload.assignedDriverMembershipId) {
    rooms.push(getMembershipRoom(payload.assignedDriverMembershipId));
  }

  getRealtimeServer()
    .to([...new Set(rooms)])
    .emit("delivery:status-updated", payload);
};

export {
  emitInventoryChanged,
  emitKitchenTicketItemStatusUpdated,
  emitOrderConfirmed,
  emitOrderCreated,
  emitOrderItemCancelled,
  emitOrderItemQuantityCancelled,
  emitOrderItemRemoved,
  emitOrderItemsAdded,
  emitOrderItemUpdated,
  emitOrderStatusUpdated,
  emitOrderUpdated,
  emitPublicOrderRequestCreated,
  emitPublicOrderRequestStatusUpdated,
  emitPublicOrderRequestOrderConfirmed,
  emitPublicOrderRequestPreparationUpdated,
  emitPublicOrderRequestOrderClosed,
  emitDeliveryStatusUpdated,
};
