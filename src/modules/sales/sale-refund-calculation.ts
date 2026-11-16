import {
  decimalToRoundedScaledBigInt,
  decimalToScaledBigInt,
  isScaledValueAligned,
  rescaleBigInt,
  scaledBigIntToDecimal,
} from "../../shared/math/fixed-decimal";

const DATABASE_MONEY_SCALE = 6;
const REFUND_MONEY_SCALE = 2;

interface RefundItemMoneyInput {
  originalTotalAmount: string;
  originalTaxAmount: string;
  refundedTotalAmount: string;
  refundedTaxAmount: string;
  originalQuantity: number;
  availableQuantity: number;
  requestedQuantity: number;
}

interface RefundItemMoneyAllocation {
  netAmountCents: bigint;
  taxAmountCents: bigint;
  totalAmountCents: bigint;
}

const minimumBigInt = (...values: readonly bigint[]): bigint => {
  const first = values[0];

  if (first === undefined) {
    throw new Error("Debes proporcionar al menos un valor");
  }

  return values
    .slice(1)
    .reduce((minimum, value) => (value < minimum ? value : minimum), first);
};

const databaseMoneyToRoundedCents = (value: string): bigint =>
  decimalToRoundedScaledBigInt(
    value,
    DATABASE_MONEY_SCALE,
    REFUND_MONEY_SCALE,
    "HALF_UP",
  );

const databaseMoneyToExactCents = (value: string): bigint | null => {
  const databaseValue = decimalToScaledBigInt(value, DATABASE_MONEY_SCALE);

  if (
    !isScaledValueAligned(
      databaseValue,
      DATABASE_MONEY_SCALE,
      REFUND_MONEY_SCALE,
    )
  ) {
    return null;
  }

  return rescaleBigInt(
    databaseValue,
    DATABASE_MONEY_SCALE,
    REFUND_MONEY_SCALE,
    "TRUNCATE",
  );
};

const inputMoneyToCents = (value: string): bigint =>
  decimalToScaledBigInt(value, REFUND_MONEY_SCALE);

const centsToMoney = (value: bigint): string =>
  scaledBigIntToDecimal(value, REFUND_MONEY_SCALE);

const allocateCentComponent = (
  originalAmountCents: bigint,
  refundedAmountCents: bigint,
  originalQuantity: number,
  availableQuantity: number,
  requestedQuantity: number,
): bigint => {
  if (
    originalQuantity <= 0 ||
    availableQuantity <= 0 ||
    requestedQuantity <= 0 ||
    requestedQuantity > availableQuantity
  ) {
    throw new Error("Las cantidades de devolución no son válidas");
  }

  const remainingAmount = originalAmountCents - refundedAmountCents;

  if (remainingAmount < 0n) {
    throw new Error(
      "El importe devuelto históricamente supera el importe original",
    );
  }

  if (requestedQuantity === availableQuantity) {
    return remainingAmount;
  }

  const proportionalAmount =
    (originalAmountCents * BigInt(requestedQuantity)) /
    BigInt(originalQuantity);

  return proportionalAmount < remainingAmount
    ? proportionalAmount
    : remainingAmount;
};

const calculateRefundItemMoney = (
  input: RefundItemMoneyInput,
): RefundItemMoneyAllocation => {
  const originalTotalCents = databaseMoneyToRoundedCents(
    input.originalTotalAmount,
  );

  const originalTaxCents = databaseMoneyToRoundedCents(input.originalTaxAmount);

  const refundedTotalCents = databaseMoneyToRoundedCents(
    input.refundedTotalAmount,
  );

  const refundedTaxCents = databaseMoneyToRoundedCents(input.refundedTaxAmount);

  if (
    originalTotalCents < 0n ||
    originalTaxCents < 0n ||
    originalTaxCents > originalTotalCents
  ) {
    throw new Error("Los importes originales del artículo no son válidos");
  }

  if (
    refundedTotalCents < 0n ||
    refundedTaxCents < 0n ||
    refundedTotalCents > originalTotalCents ||
    refundedTaxCents > originalTaxCents ||
    refundedTaxCents > refundedTotalCents
  ) {
    throw new Error("Los importes históricos de devolución no son coherentes");
  }

  const totalAmountCents = allocateCentComponent(
    originalTotalCents,
    refundedTotalCents,
    input.originalQuantity,
    input.availableQuantity,
    input.requestedQuantity,
  );

  const proportionalTaxCents = allocateCentComponent(
    originalTaxCents,
    refundedTaxCents,
    input.originalQuantity,
    input.availableQuantity,
    input.requestedQuantity,
  );

  const remainingTaxCents = originalTaxCents - refundedTaxCents;

  const taxAmountCents = minimumBigInt(
    proportionalTaxCents,
    remainingTaxCents,
    totalAmountCents,
  );

  const netAmountCents = totalAmountCents - taxAmountCents;

  return {
    netAmountCents,
    taxAmountCents,
    totalAmountCents,
  };
};

export {
  centsToMoney,
  calculateRefundItemMoney,
  databaseMoneyToExactCents,
  databaseMoneyToRoundedCents,
  inputMoneyToCents,
};

export type { RefundItemMoneyAllocation, RefundItemMoneyInput };
