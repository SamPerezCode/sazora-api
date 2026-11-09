import { AppError } from "../../shared/errors/app-error";

interface SalePaymentCalculationInput {
  amount: string;
  tenderedAmount: string;
  allowsChange: boolean;
}

interface CalculatedSalePayment {
  amount: string;
  tenderedAmount: string;
  changeAmount: string;
}

interface SaleSettlementCalculation {
  paidTotal: string;
  changeTotal: string;
  payments: CalculatedSalePayment[];
}

const parseMoneyToCents = (value: string): bigint => {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());

  if (!match) {
    throw new Error(`El valor monetario no es válido: ${value}`);
  }

  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(2, "0");

  return BigInt(whole) * 100n + BigInt(fraction || "0");
};

const parseDatabaseAmountToCents = (value: string): bigint => {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value.trim());

  if (!match) {
    throw new Error(`El valor monetario no es válido: ${value}`);
  }

  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(6, "0");
  const microUnits = BigInt(whole) * 1_000_000n + BigInt(fraction || "0");

  return (microUnits + 5_000n) / 10_000n;
};

const formatCents = (value: bigint): string => {
  const whole = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");

  return `${whole.toString()}.${fraction}`;
};

const calculateSaleSettlement = (
  saleTotal: string,
  inputs: readonly SalePaymentCalculationInput[],
): SaleSettlementCalculation => {
  const saleTotalCents = parseDatabaseAmountToCents(saleTotal);

  let paidTotalCents = 0n;
  let changeTotalCents = 0n;

  const payments = inputs.map((input, index) => {
    const amountCents = parseMoneyToCents(input.amount);
    const tenderedAmountCents = parseMoneyToCents(input.tenderedAmount);

    if (tenderedAmountCents < amountCents) {
      throw new AppError(
        `El valor recibido del pago ${index + 1} es inferior al valor aplicado`,
        400,
        "PAYMENT_TENDERED_AMOUNT_TOO_LOW",
      );
    }

    const changeAmountCents = tenderedAmountCents - amountCents;

    if (!input.allowsChange && changeAmountCents > 0n) {
      throw new AppError(
        `La forma de pago ${index + 1} no permite devolver cambio`,
        400,
        "PAYMENT_METHOD_DOES_NOT_ALLOW_CHANGE",
      );
    }

    paidTotalCents += amountCents;
    changeTotalCents += changeAmountCents;

    return {
      amount: formatCents(amountCents),
      tenderedAmount: formatCents(tenderedAmountCents),
      changeAmount: formatCents(changeAmountCents),
    };
  });

  if (paidTotalCents !== saleTotalCents) {
    throw new AppError(
      `La suma de los pagos debe ser ${formatCents(saleTotalCents)}`,
      409,
      "SALE_PAYMENT_TOTAL_MISMATCH",
    );
  }

  return {
    paidTotal: formatCents(paidTotalCents),
    changeTotal: formatCents(changeTotalCents),
    payments,
  };
};

export { calculateSaleSettlement };

export type {
  CalculatedSalePayment,
  SalePaymentCalculationInput,
  SaleSettlementCalculation,
};
