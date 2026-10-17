const decimalToScaledBigInt = (value: string, scale: number): bigint => {
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

  const scaledFraction = fraction.padEnd(scale, "0").slice(0, scale);

  const result =
    BigInt(whole) * multiplier +
    BigInt(scaledFraction.length > 0 ? scaledFraction : "0");

  return result * sign;
};

const scaledBigIntToDecimal = (value: bigint, scale: number): string => {
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

export { decimalToScaledBigInt, scaledBigIntToDecimal };
