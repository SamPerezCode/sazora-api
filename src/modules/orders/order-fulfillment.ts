import type { OrderFulfillmentSummary, OrderItem } from "./order.types";

type SummarizableOrderItem = Pick<
  OrderItem,
  "fulfillmentMode" | "quantity" | "status"
>;

const summarizeOrderFulfillment = (
  items: readonly SummarizableOrderItem[],
): OrderFulfillmentSummary => {
  let activeItemCount = 0;
  let activeUnitCount = 0;
  let readyToServeUnitCount = 0;
  let prepareToOrderUnitCount = 0;

  for (const item of items) {
    if (item.status !== "ACTIVE") {
      continue;
    }

    activeItemCount += 1;
    activeUnitCount += item.quantity;

    if (item.fulfillmentMode === "PREPARE_TO_ORDER") {
      prepareToOrderUnitCount += item.quantity;
    } else {
      readyToServeUnitCount += item.quantity;
    }
  }

  return {
    activeItemCount,
    activeUnitCount,
    readyToServeUnitCount,
    prepareToOrderUnitCount,
    requiresPreparation: prepareToOrderUnitCount > 0,
  };
};

export { summarizeOrderFulfillment };
