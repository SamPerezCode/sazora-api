import { AppError } from "../../../shared/errors/app-error";
import type {
  CreatePaymentMethodData,
  PaymentMethod,
  PaymentType,
  UpdatePaymentMethodData,
} from "../payment-method.types";
import {
  findPaymentMethodByCode,
  findPaymentMethodById,
  findPaymentMethods,
  insertPaymentMethod,
  updatePaymentMethodById,
  updatePaymentMethodStatusById,
} from "../repositories/payment-method.repository";
import type {
  CreatePaymentMethodInput,
  UpdatePaymentMethodInput,
  UpdatePaymentMethodStatusInput,
} from "../schemas/payment-method.schema";

const affectsCash = (paymentType: PaymentType): boolean =>
  paymentType === "CASH";

const assertAllowsChange = (
  paymentType: PaymentType,
  allowsChange: boolean,
): void => {
  if (allowsChange && paymentType !== "CASH") {
    throw new AppError(
      "Solamente los pagos en efectivo pueden devolver cambio",
      400,
      "PAYMENT_METHOD_CHANGE_NOT_ALLOWED",
    );
  }
};

const listPaymentMethods = async (
  businessId: string,
  activeOnly: boolean,
): Promise<PaymentMethod[]> => findPaymentMethods(businessId, activeOnly);

const getPaymentMethod = async (
  businessId: string,
  paymentMethodId: string,
): Promise<PaymentMethod> => {
  const paymentMethod = await findPaymentMethodById(
    businessId,
    paymentMethodId,
  );

  if (!paymentMethod) {
    throw new AppError(
      "La forma de pago no existe",
      404,
      "PAYMENT_METHOD_NOT_FOUND",
    );
  }

  return paymentMethod;
};

const createPaymentMethod = async (
  businessId: string,
  input: CreatePaymentMethodInput,
): Promise<PaymentMethod> => {
  assertAllowsChange(input.paymentType, input.allowsChange);

  const existing = await findPaymentMethodByCode(businessId, input.code);

  if (existing) {
    throw new AppError(
      "Ya existe una forma de pago con este código",
      409,
      "PAYMENT_METHOD_CODE_CONFLICT",
    );
  }

  const data: CreatePaymentMethodData = {
    code: input.code,
    name: input.name,
    paymentType: input.paymentType,
    requiresReference: input.requiresReference,
    affectsCash: affectsCash(input.paymentType),
    allowsChange: input.allowsChange,
    displayOrder: input.displayOrder,
  };

  return insertPaymentMethod(businessId, data);
};

const updatePaymentMethod = async (
  businessId: string,
  paymentMethodId: string,
  input: UpdatePaymentMethodInput,
): Promise<PaymentMethod> => {
  const current = await getPaymentMethod(businessId, paymentMethodId);

  const code = input.code ?? current.code;

  if (code !== current.code) {
    const existing = await findPaymentMethodByCode(businessId, code);

    if (existing && existing.id !== paymentMethodId) {
      throw new AppError(
        "Ya existe una forma de pago con este código",
        409,
        "PAYMENT_METHOD_CODE_CONFLICT",
      );
    }
  }

  const paymentType = input.paymentType ?? current.paymentType;
  const allowsChange = input.allowsChange ?? current.allowsChange;

  assertAllowsChange(paymentType, allowsChange);

  const data: UpdatePaymentMethodData = {
    code,
    name: input.name ?? current.name,
    paymentType,
    requiresReference: input.requiresReference ?? current.requiresReference,
    affectsCash: affectsCash(paymentType),
    allowsChange,
    displayOrder: input.displayOrder ?? current.displayOrder,
  };

  const paymentMethod = await updatePaymentMethodById(
    businessId,
    paymentMethodId,
    data,
  );

  if (!paymentMethod) {
    throw new AppError(
      "La forma de pago no existe",
      404,
      "PAYMENT_METHOD_NOT_FOUND",
    );
  }

  return paymentMethod;
};

const changePaymentMethodStatus = async (
  businessId: string,
  paymentMethodId: string,
  input: UpdatePaymentMethodStatusInput,
): Promise<PaymentMethod> => {
  const current = await getPaymentMethod(businessId, paymentMethodId);

  if (current.isActive === input.isActive) {
    return current;
  }

  const paymentMethod = await updatePaymentMethodStatusById(
    businessId,
    paymentMethodId,
    input.isActive,
  );

  if (!paymentMethod) {
    throw new AppError(
      "La forma de pago no existe",
      404,
      "PAYMENT_METHOD_NOT_FOUND",
    );
  }

  return paymentMethod;
};

export {
  changePaymentMethodStatus,
  createPaymentMethod,
  getPaymentMethod,
  listPaymentMethods,
  updatePaymentMethod,
};
