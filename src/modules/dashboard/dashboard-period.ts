import type {
  DashboardDayPeriod,
  DashboardPeriod,
  DashboardWeekday,
} from "./dashboard.types";

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

const weekdays: readonly DashboardWeekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

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

const getLocalDate = (date: Date, timezone: string): LocalDate => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: readNumericPart(parts, "year"),
    month: readNumericPart(parts, "month"),
    day: readNumericPart(parts, "day"),
  };
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

const addCalendarDays = (localDate: LocalDate, amount: number): LocalDate => {
  const date = new Date(
    Date.UTC(localDate.year, localDate.month - 1, localDate.day + amount),
  );

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

const formatLocalDate = (localDate: LocalDate): string =>
  [
    localDate.year.toString().padStart(4, "0"),
    localDate.month.toString().padStart(2, "0"),
    localDate.day.toString().padStart(2, "0"),
  ].join("-");

const formatUtcForDatabase = (date: Date): string =>
  date.toISOString().slice(0, 23).replace("T", " ");

const getMondayOffset = (localDate: LocalDate): number => {
  const weekday = new Date(
    Date.UTC(localDate.year, localDate.month - 1, localDate.day),
  ).getUTCDay();

  return (weekday + 6) % 7;
};

const createDashboardPeriod = (
  timezone: string,
  now = new Date(),
): DashboardPeriod => {
  const today = getLocalDate(now, timezone);
  const yesterday = addCalendarDays(today, -1);
  const tomorrow = addCalendarDays(today, 1);

  const mondayOffset = getMondayOffset(today);
  const weekStartDate = addCalendarDays(today, -mondayOffset);
  const nextWeekStartDate = addCalendarDays(weekStartDate, 7);

  const days: DashboardDayPeriod[] = weekdays.map((weekday, dayIndex) => {
    const date = addCalendarDays(weekStartDate, dayIndex);
    const nextDate = addCalendarDays(date, 1);

    return {
      date: formatLocalDate(date),
      dayOfWeek: dayIndex + 1,
      weekday,
      start: formatUtcForDatabase(localMidnightToUtc(date, timezone)),
      end: formatUtcForDatabase(localMidnightToUtc(nextDate, timezone)),
    };
  });

  return {
    timezone,
    today: formatLocalDate(today),
    weekStart: formatLocalDate(weekStartDate),
    weekEnd: formatLocalDate(addCalendarDays(nextWeekStartDate, -1)),
    yesterdayStart: formatUtcForDatabase(
      localMidnightToUtc(yesterday, timezone),
    ),
    todayStart: formatUtcForDatabase(localMidnightToUtc(today, timezone)),
    tomorrowStart: formatUtcForDatabase(localMidnightToUtc(tomorrow, timezone)),
    days,
  };
};

export { createDashboardPeriod };
