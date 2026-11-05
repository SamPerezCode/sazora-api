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
 * AccessTokenPayload contiene solamente el contexto firmado en el JWT.
 *
 * Los permisos y las ubicaciones se recuperan desde la base de datos
 * en cada petición autenticada para reflejar cambios administrativos.
 */
type AuthenticatedSession = Readonly<
  AccessTokenPayload & {
    permissions: readonly string[];
    locationAccess: SessionLocationAccess;
  }
>;

export type {
  AccessTokenPayload,
  AuthenticatedSession,
  SessionLocation,
  SessionLocationAccess,
};
