import type { PoolConnection } from "mysql2/promise";

import type {
  CommercialCustomer,
  ResolveCommercialCustomerData,
  UpsertCommercialCustomerIdentityData,
} from "../commercial-customer.types";
import { normalizeCommercialCustomerPhone } from "../customer-phone";
import { upsertCommercialCustomerIdentity } from "../repositories/commercial-customer.repository";

const normalizeCustomerName = (value: string): string => {
  const normalizedName = value.trim().replace(/\s+/g, " ");

  if (normalizedName.length === 0) {
    throw new Error(
      "No es posible identificar un cliente sin un nombre válido",
    );
  }

  return normalizedName;
};

const normalizeCustomerEmail = (value: string | null): string | null => {
  if (value === null) {
    return null;
  }

  const normalizedEmail = value.trim().toLowerCase();

  return normalizedEmail.length > 0 ? normalizedEmail : null;
};

/**
 * Resuelve la identidad comercial dentro de una transacción existente.
 *
 * No abre ni confirma transacciones por su cuenta. Esto permite que la
 * creación del cliente y la creación de la solicitud u orden sean atómicas.
 *
 * Si el teléfono no puede convertirse de forma segura a E.164, devuelve null.
 * En ese caso el pedido puede conservar sus datos de contacto, pero todavía
 * no queda relacionado con una identidad comercial.
 */
const resolveCommercialCustomer = async (
  connection: PoolConnection,
  businessId: string,
  data: ResolveCommercialCustomerData,
): Promise<CommercialCustomer | null> => {
  const normalizedPhone = normalizeCommercialCustomerPhone(data.customerPhone);

  if (normalizedPhone === null) {
    return null;
  }

  const customerData: UpsertCommercialCustomerIdentityData = {
    legalName: normalizeCustomerName(data.customerName),
    billingEmail: normalizeCustomerEmail(data.customerEmail),
    billingPhone: data.customerPhone.trim(),
    normalizedPhone,
    sourceChannel: data.sourceChannel,
    marketingConsent: data.marketingConsent ?? null,
  };

  return upsertCommercialCustomerIdentity(connection, businessId, customerData);
};

export { resolveCommercialCustomer };
