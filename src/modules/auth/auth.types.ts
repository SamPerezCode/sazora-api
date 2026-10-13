import type { LocationType } from "../locations/location.types";

type AccessTokenPayload = Readonly<{
  tokenType: "access";
  userId: string;
  businessId: string;
  membershipId: string;
  authVersion: number;
  roles: string[];
}>;

type SessionLocation = Readonly<{
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
  isDefault: boolean;
}>;

type SessionLocationAccess = Readonly<{
  hasGlobalAccess: boolean;
  defaultLocationId: string | null;
  locations: readonly SessionLocation[];
}>;

/*
 * AccessTokenPayload representa únicamente el contenido firmado dentro
 * del JWT.
 *
 * AuthenticatedSession representa el contexto fresco recuperado desde
 * la base de datos para una petición HTTP autenticada.
 *
 * locationAccess no se almacena dentro del token.
 */
type AuthenticatedSession = Readonly<
  AccessTokenPayload & {
    locationAccess: SessionLocationAccess;
  }
>;

export type {
  AccessTokenPayload,
  AuthenticatedSession,
  SessionLocation,
  SessionLocationAccess,
};
