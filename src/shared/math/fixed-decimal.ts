type DecimalRoundingMode = "TRUNCATE" | "HALF_UP";

const assertScale = (scale: number): void => {
  if (!Number.isInteger(scale) || scale < 0) {
    throw new Error(`Escala decimal inválida: ${scale}`);
  }
};

const decimalToScaledBigInt = (value: string, scale: number): bigint => {
  assertScale(scale);

  const normalized = value.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(normalized);

  if (!match) {
    throw new Error(`Decimal inválido: ${value}`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2] ?? "0";
  const fraction = match[3] ?? "";

  if (fraction.length > scale) {
    throw new Error(
      `El decimal ${value} supera la escala permitida de ${scale}`,
    );
  }

  const multiplier = 10n ** BigInt(scale);
  const scaledFraction = fraction.padEnd(scale, "0");

  const result =
    BigInt(whole) * multiplier +
    BigInt(scaledFraction.length > 0 ? scaledFraction : "0");

  return result * sign;
};

const scaledBigIntToDecimal = (value: bigint, scale: number): string => {
  assertScale(scale);

  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const multiplier = 10n ** BigInt(scale);
  const whole = absolute / multiplier;

  if (scale === 0) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const fraction = (absolute % multiplier).toString().padStart(scale, "0");

  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
};

const rescaleBigInt = (
  value: bigint,
  sourceScale: number,
  targetScale: number,
  roundingMode: DecimalRoundingMode = "TRUNCATE",
): bigint => {
  assertScale(sourceScale);
  assertScale(targetScale);

  if (sourceScale === targetScale) {
    return value;
  }

  if (sourceScale < targetScale) {
    return value * 10n ** BigInt(targetScale - sourceScale);
  }

  const divisor = 10n ** BigInt(sourceScale - targetScale);
  const quotient = value / divisor;

  if (roundingMode === "TRUNCATE") {
    return quotient;
  }

  const remainder = value % divisor;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;

  if (absoluteRemainder * 2n < divisor) {
    return quotient;
  }

  return quotient + (value < 0n ? -1n : 1n);
};

const decimalToRoundedScaledBigInt = (
  value: string,
  sourceScale: number,
  targetScale: number,
  roundingMode: DecimalRoundingMode = "HALF_UP",
): bigint =>
  rescaleBigInt(
    decimalToScaledBigInt(value, sourceScale),
    sourceScale,
    targetScale,
    roundingMode,
  );

const isScaledValueAligned = (
  value: bigint,
  sourceScale: number,
  targetScale: number,
): boolean => {
  assertScale(sourceScale);
  assertScale(targetScale);

  if (sourceScale <= targetScale) {
    return true;
  }

  const divisor = 10n ** BigInt(sourceScale - targetScale);

  return value % divisor === 0n;
};

export {
  decimalToRoundedScaledBigInt,
  decimalToScaledBigInt,
  isScaledValueAligned,
  rescaleBigInt,
  scaledBigIntToDecimal,
};

export type { DecimalRoundingMode };
