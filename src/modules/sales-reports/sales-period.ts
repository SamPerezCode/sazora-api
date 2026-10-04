import type { SalesPeriod } from "./sales-report.types";

type LocalDate = Readonly<{
  year: number;
  month: number;
  day: number;
}>;

type ZonedDateTimeParts = LocalDate &
  Readonly<{
    hour: number;
    minute: number;
    second: number;
  }>;

const parseLocalDate = (value: string): LocalDate => {
  const [yearText, monthText, dayText] = value.split("-");

  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
  };
};

const addCalendarDays = (date: LocalDate, amount: number): LocalDate => {
  const result = new Date(
    Date.UTC(date.year, date.month - 1, date.day + amount),
  );

  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
};

const readNumericPart = (
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number => {
  const value = parts.find((part) => part.type === type)?.value;

  if (!value) {
    throw new Error(`No fue posible obtener la parte de fecha ${type}`);
  }

  return Number(value);
};

const getZonedDateTimeParts = (
  date: Date,
  timezone: string,
): ZonedDateTimeParts => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return {
    year: readNumericPart(parts, "year"),
    month: readNumericPart(parts, "month"),
    day: readNumericPart(parts, "day"),
    hour: readNumericPart(parts, "hour"),
    minute: readNumericPart(parts, "minute"),
    second: readNumericPart(parts, "second"),
  };
};

const getTimezoneOffsetMilliseconds = (
  date: Date,
  timezone: string,
): number => {
  const parts = getZonedDateTimeParts(date, timezone);

  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  const dateWithoutMilliseconds = Math.floor(date.getTime() / 1000) * 1000;

  return representedAsUtc - dateWithoutMilliseconds;
};

const localMidnightToUtc = (localDate: LocalDate, timezone: string): Date => {
  const targetMilliseconds = Date.UTC(
    localDate.year,
    localDate.month - 1,
    localDate.day,
    0,
    0,
    0,
    0,
  );

  let utcMilliseconds = targetMilliseconds;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const offset = getTimezoneOffsetMilliseconds(
      new Date(utcMilliseconds),
      timezone,
    );

    utcMilliseconds = targetMilliseconds - offset;
  }

  return new Date(utcMilliseconds);
};

const formatUtcForDatabase = (date: Date): string =>
  date.toISOString().slice(0, 23).replace("T", " ");

const createSalesPeriod = (
  from: string,
  to: string,
  timezone: string,
): SalesPeriod => {
  const startDate = parseLocalDate(from);
  const endDateExclusive = addCalendarDays(parseLocalDate(to), 1);

  return {
    from,
    to,
    timezone,
    start: formatUtcForDatabase(localMidnightToUtc(startDate, timezone)),
    end: formatUtcForDatabase(localMidnightToUtc(endDateExclusive, timezone)),
  };
};

export { createSalesPeriod };
