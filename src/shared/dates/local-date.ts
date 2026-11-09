const readDatePart = (
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string => {
  const value = parts.find((part) => part.type === type)?.value;

  if (!value) {
    throw new Error(`No fue posible obtener la parte de fecha ${type}`);
  }

  return value;
};

const formatDateInTimezone = (date: Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = readDatePart(parts, "year");
  const month = readDatePart(parts, "month");
  const day = readDatePart(parts, "day");

  return `${year}-${month}-${day}`;
};

export { formatDateInTimezone };
