import { AppError } from "../../../shared/errors/app-error";
import type { OperationalContext } from "../operational-context.types";
import { findOperationalContextByBusinessId } from "../repositories/operational-context.repository";

const getOperationalContext = async (
  businessId: string,
): Promise<OperationalContext> => {
  const context = await findOperationalContextByBusinessId(businessId);

  if (!context) {
    throw new AppError(
      "No fue posible obtener el contexto operativo del negocio",
      404,
      "BUSINESS_CONTEXT_NOT_FOUND",
    );
  }

  return context;
};

export { getOperationalContext };
