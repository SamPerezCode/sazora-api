interface OrderTaxCalculationInput {
  listedUnitPrice: string;
  taxRate: string;
  priceIncludesTax: boolean;
}

interface OrderTaxCalculation {
  unitPrice: string;
  unitNetPrice: string;
  unitTaxAmount: string;
}

const CURRENCY_DECIMAL_PLACES = 6;
const RATE_DECIMAL_PLACES = 4;

const CENT_IN_MICRO_UNITS = 10_000n;

/*
 * Una tasa con cuatro decimales se representa así:
 *
 * 19.0000% = 190000
 * 100.0000% = 1000000
 */
const PERCENTAGE_SCALE = 1_000_000n;

const parseUnsignedDecimal = (value: string, decimalPlaces: number): bigint => {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());

  if (!match) {
    throw new Error(`El valor decimal no es válido: ${value}`);
  }

  const whole = match[1] ?? "0";
  const fraction = match[2] ?? "";

  if (fraction.length > decimalPlaces) {
    throw new Error(
      `El valor ${value} supera los ${decimalPlaces} decimales permitidos`,
    );
  }

  const scale = 10n ** BigInt(decimalPlaces);

  const normalizedFraction = fraction
    .padEnd(decimalPlaces, "0")
    .slice(0, decimalPlaces);

  return BigInt(whole) * scale + BigInt(normalizedFraction || "0");
};

const formatDecimal = (value: bigint, decimalPlaces: number): string => {
  const scale = 10n ** BigInt(decimalPlaces);
  const whole = value / scale;
  const fraction = (value % scale).toString().padStart(decimalPlaces, "0");

  return `${whole.toString()}.${fraction}`;
};

const divideAndRoundHalfUp = (
  numerator: bigint,
  denominator: bigint,
): bigint => {
  if (denominator <= 0n) {
    throw new Error("El divisor debe ser mayor que cero");
  }

  return (numerator + denominator / 2n) / denominator;
};

const roundMicroUnitsToCents = (value: bigint): bigint =>
  divideAndRoundHalfUp(value, CENT_IN_MICRO_UNITS) * CENT_IN_MICRO_UNITS;

const formatMicroUnitsAsMoney = (value: bigint): string => {
  const cents = value / CENT_IN_MICRO_UNITS;

  return formatDecimal(cents, 2);
};

const calculateOrderItemTax = (
  input: OrderTaxCalculationInput,
): OrderTaxCalculation => {
  const listedUnitPrice = parseUnsignedDecimal(
    input.listedUnitPrice,
    CURRENCY_DECIMAL_PLACES,
  );

  const taxRate = parseUnsignedDecimal(input.taxRate, RATE_DECIMAL_PLACES);

  if (taxRate > PERCENTAGE_SCALE) {
    throw new Error("La tarifa del impuesto no puede superar el 100%");
  }

  if (taxRate === 0n) {
    const roundedUnitPrice = roundMicroUnitsToCents(listedUnitPrice);

    return {
      unitPrice: formatMicroUnitsAsMoney(roundedUnitPrice),
      unitNetPrice: formatDecimal(roundedUnitPrice, CURRENCY_DECIMAL_PLACES),
      unitTaxAmount: formatDecimal(0n, CURRENCY_DECIMAL_PLACES),
    };
  }

  if (input.priceIncludesTax) {
    const grossUnitPrice = roundMicroUnitsToCents(listedUnitPrice);

    const netUnitPrice = divideAndRoundHalfUp(
      grossUnitPrice * PERCENTAGE_SCALE,
      PERCENTAGE_SCALE + taxRate,
    );

    const unitTaxAmount = grossUnitPrice - netUnitPrice;

    return {
      unitPrice: formatMicroUnitsAsMoney(grossUnitPrice),
      unitNetPrice: formatDecimal(netUnitPrice, CURRENCY_DECIMAL_PLACES),
      unitTaxAmount: formatDecimal(unitTaxAmount, CURRENCY_DECIMAL_PLACES),
    };
  }

  const netUnitPrice = roundMicroUnitsToCents(listedUnitPrice);

  const calculatedTax = divideAndRoundHalfUp(
    netUnitPrice * taxRate,
    PERCENTAGE_SCALE,
  );

  const grossUnitPrice = roundMicroUnitsToCents(netUnitPrice + calculatedTax);

  const unitTaxAmount = grossUnitPrice - netUnitPrice;

  return {
    unitPrice: formatMicroUnitsAsMoney(grossUnitPrice),
    unitNetPrice: formatDecimal(netUnitPrice, CURRENCY_DECIMAL_PLACES),
    unitTaxAmount: formatDecimal(unitTaxAmount, CURRENCY_DECIMAL_PLACES),
  };
};

export { calculateOrderItemTax };

export type { OrderTaxCalculation, OrderTaxCalculationInput };
