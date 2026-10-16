import type { AuthenticatedSession } from "../../auth/auth.types";
import { AppError } from "../../../shared/errors/app-error";
import type { KitchenProgressStatus } from "../kitchen-ticket.types";

const assertKitchenStatusPermission = (
  auth: AuthenticatedSession,
  status: KitchenProgressStatus,
): void => {
  if (auth.roles.includes("ADMIN")) {
    return;
  }

  if (status === "DELIVERED" && auth.roles.includes("WAITER")) {
    return;
  }

  if (
    (status === "IN_PREPARATION" || status === "READY") &&
    auth.roles.includes("KITCHEN")
  ) {
    return;
  }

  throw new AppError(
    "Tu rol no puede realizar este cambio de preparación",
    403,
    "KITCHEN_STATUS_PERMISSION_DENIED",
  );
};

export { assertKitchenStatusPermission };
