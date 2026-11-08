import { AppError } from "../../../shared/errors/app-error";
import type {
  CreateTaxClassData,
  CreateTaxRateData,
  TaxClass,
  TaxType,
  UpdateTaxClassData,
} from "../tax-class.types";
import {
  createTaxClass as createTaxClassRecord,
  createTaxRate as createTaxRateRecord,
  findTaxClassById,
  findTaxClassesByBusinessId,
  hasOverlappingTaxRate,
  updateTaxClass as updateTaxClassRecord,
  updateTaxClassStatus as updateTaxClassStatusRecord,
} from "../repositories/tax-class.repository";
import type {
  CreateTaxClassInput,
  CreateTaxRateInput,
  UpdateTaxClassInput,
  UpdateTaxClassStatusInput,
} from "../schemas/tax-class.schema";

const zeroRateTaxTypes = new Set<TaxType>(["EXEMPT", "EXCLUDED", "NON_TAXED"]);

const hasMySqlErrorCode = (error: unknown, expectedCode: string): boolean => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === expectedCode;
};

const assertRateMatchesTaxType = (taxType: TaxType, rate: string): void => {
  const numericRate = Number(rate);

  if (zeroRateTaxTypes.has(taxType) && numericRate !== 0) {
    throw new AppError(
      "Las clases exentas, excluidas o no gravadas deben tener tarifa 0",
      400,
      "TAX_RATE_MUST_BE_ZERO",
    );
  }

  if ((taxType === "VAT" || taxType === "CONSUMPTION") && numericRate <= 0) {
    throw new AppError(
      "Los impuestos de IVA o consumo deben tener una tarifa mayor que 0",
      400,
      "TAX_RATE_MUST_BE_POSITIVE",
    );
  }
};

const getTaxClass = async (
  businessId: string,
  taxClassId: string,
): Promise<TaxClass> => {
  const taxClass = await findTaxClassById(businessId, taxClassId);

  if (!taxClass) {
    throw new AppError(
      "La clase de impuesto no existe",
      404,
      "TAX_CLASS_NOT_FOUND",
    );
  }

  return taxClass;
};

const listTaxClasses = async (businessId: string): Promise<TaxClass[]> =>
  findTaxClassesByBusinessId(businessId);

const createTaxClass = async (
  businessId: string,
  input: CreateTaxClassInput,
): Promise<TaxClass> => {
  assertRateMatchesTaxType(input.taxType, input.initialRate.rate);

  const data: CreateTaxClassData = {
    code: input.code,
    name: input.name,
    taxType: input.taxType,
    description: input.description,
    initialRate: {
      rate: input.initialRate.rate,
      validFrom: input.initialRate.validFrom,
      validTo: input.initialRate.validTo,
    },
  };

  try {
    return await createTaxClassRecord(businessId, data);
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una clase de impuesto con ese código",
        409,
        "TAX_CLASS_CODE_CONFLICT",
      );
    }

    throw error;
  }
};

const updateTaxClass = async (
  businessId: string,
  taxClassId: string,
  input: UpdateTaxClassInput,
): Promise<TaxClass> => {
  await getTaxClass(businessId, taxClassId);

  const data: UpdateTaxClassData = {};

  if (input.code !== undefined) {
    data.code = input.code;
  }

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.description !== undefined) {
    data.description = input.description;
  }

  try {
    const taxClass = await updateTaxClassRecord(businessId, taxClassId, data);

    if (!taxClass) {
      throw new AppError(
        "La clase de impuesto no existe",
        404,
        "TAX_CLASS_NOT_FOUND",
      );
    }

    return taxClass;
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una clase de impuesto con ese código",
        409,
        "TAX_CLASS_CODE_CONFLICT",
      );
    }

    throw error;
  }
};

const changeTaxClassStatus = async (
  businessId: string,
  taxClassId: string,
  input: UpdateTaxClassStatusInput,
): Promise<TaxClass> => {
  const currentTaxClass = await getTaxClass(businessId, taxClassId);

  if (currentTaxClass.isActive === input.isActive) {
    return currentTaxClass;
  }

  const taxClass = await updateTaxClassStatusRecord(
    businessId,
    taxClassId,
    input.isActive,
  );

  if (!taxClass) {
    throw new AppError(
      "La clase de impuesto no existe",
      404,
      "TAX_CLASS_NOT_FOUND",
    );
  }

  return taxClass;
};

const addTaxRate = async (
  businessId: string,
  taxClassId: string,
  input: CreateTaxRateInput,
): Promise<TaxClass> => {
  const currentTaxClass = await getTaxClass(businessId, taxClassId);

  if (!currentTaxClass.isActive) {
    throw new AppError(
      "No puedes agregar tarifas a una clase de impuesto inactiva",
      409,
      "TAX_CLASS_INACTIVE",
    );
  }

  assertRateMatchesTaxType(currentTaxClass.taxType, input.rate);

  const overlaps = await hasOverlappingTaxRate(
    businessId,
    taxClassId,
    input.validFrom,
    input.validTo,
  );

  if (overlaps) {
    throw new AppError(
      "El periodo de la tarifa se superpone con una tarifa existente",
      409,
      "TAX_RATE_VALIDITY_OVERLAP",
    );
  }

  const data: CreateTaxRateData = {
    rate: input.rate,
    validFrom: input.validFrom,
    validTo: input.validTo,
  };

  try {
    const taxClass = await createTaxRateRecord(businessId, taxClassId, data);

    if (!taxClass) {
      throw new AppError(
        "La clase de impuesto no existe",
        404,
        "TAX_CLASS_NOT_FOUND",
      );
    }

    return taxClass;
  } catch (error) {
    if (hasMySqlErrorCode(error, "ER_DUP_ENTRY")) {
      throw new AppError(
        "Ya existe una tarifa con la misma fecha inicial",
        409,
        "TAX_RATE_DATE_CONFLICT",
      );
    }

    throw error;
  }
};

export {
  addTaxRate,
  changeTaxClassStatus,
  createTaxClass,
  getTaxClass,
  listTaxClasses,
  updateTaxClass,
};
