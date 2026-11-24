const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

const removeInternationalAccessPrefix = (digits: string): string =>
  digits.startsWith("00") ? digits.slice(2) : digits;

/**
 * Convierte un teléfono en un valor canónico E.164.
 *
 * Reglas iniciales para Colombia:
 *
 * 3006018789     -> +573006018789
 * 573006018789   -> +573006018789
 * +573006018789  -> +573006018789
 * 00573006018789 -> +573006018789
 *
 * Un número que ya trae prefijo internacional explícito conserva su país.
 * Un número nacional de diez dígitos se interpreta como colombiano.
 *
 * Devuelve null cuando el valor no permite construir una identidad
 * internacional inequívoca.
 */
const normalizeCommercialCustomerPhone = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  const hasExplicitInternationalPrefix =
    trimmedValue.startsWith("+") || trimmedValue.startsWith("00");

  const extractedDigits = trimmedValue.replace(/\D/g, "");
  const digits = removeInternationalAccessPrefix(extractedDigits);

  if (digits.length === 0) {
    return null;
  }

  let normalizedPhone: string;

  if (digits.length === 10 && !hasExplicitInternationalPrefix) {
    normalizedPhone = `+57${digits}`;
  } else if (digits.length === 12 && digits.startsWith("57")) {
    normalizedPhone = `+${digits}`;
  } else if (hasExplicitInternationalPrefix) {
    normalizedPhone = `+${digits}`;
  } else {
    return null;
  }

  return E164_PHONE_PATTERN.test(normalizedPhone) ? normalizedPhone : null;
};

const isNormalizedCommercialCustomerPhone = (value: string): boolean =>
  E164_PHONE_PATTERN.test(value);

export {
  isNormalizedCommercialCustomerPhone,
  normalizeCommercialCustomerPhone,
};
