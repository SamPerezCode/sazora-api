import { AppError } from "../../../shared/errors/app-error";
import type { SessionLocationAccess } from "../auth.types";
import { findSessionLocationAccess } from "../repositories/auth-location.repository";
import {
  findLoginIdentity,
  updateLastLogin,
} from "../repositories/auth.repository";
import { findPermissionsForRoles } from "../repositories/permission.repository";
import type { LoginInput } from "../schemas/login.schema";
import { verifyPassword } from "./password.service";
import {
  ROLE_SELECTION_TOKEN_EXPIRES_IN_SECONDS,
  signAccessToken,
  signRoleSelectionToken,
} from "./token.service";

const DUMMY_PASSWORD_HASH =
  "$2b$12$EHvKwFJzIWLC7pSP16OpN.GKtMmH5Gat7aSpbynx8p5IdF7OvGq";

type LoginUser = Readonly<{
  id: string;
  fullName: string;
}>;

type LoginBusiness = Readonly<{
  id: string;
  name: string;
  slug: string;
}>;

type DirectLoginResult = Readonly<{
  requiresRoleSelection: false;
  authorizationMode: "SINGLE_ROLE";
  accessToken: string;

  user: LoginUser;
  business: LoginBusiness;

  membership: {
    id: string;
    roles: string[];
    permissions: string[];
  };

  locationAccess: SessionLocationAccess;
}>;

type PendingRoleSelectionResult = Readonly<{
  requiresRoleSelection: true;
  roleSelectionToken: string;
  roleSelectionExpiresInSeconds: number;

  user: LoginUser;
  business: LoginBusiness;

  membership: {
    id: string;
    roles: string[];
  };
}>;

type LoginResult = DirectLoginResult | PendingRoleSelectionResult;

const login = async (input: LoginInput): Promise<LoginResult> => {
  const identity = await findLoginIdentity({
    email: input.email,
    businessSlug: input.businessSlug,
  });

  const passwordHash = identity?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordIsValid = await verifyPassword(input.password, passwordHash);

  if (!identity || !passwordIsValid) {
    throw new AppError("Credenciales inválidas", 401, "INVALID_CREDENTIALS");
  }

  const user: LoginUser = {
    id: identity.userId,
    fullName: identity.fullName,
  };

  const business: LoginBusiness = {
    id: identity.businessId,
    name: identity.businessName,
    slug: identity.businessSlug,
  };

  await updateLastLogin(identity.userId);

  if (identity.roles.length > 1) {
    const roleSelectionToken = signRoleSelectionToken({
      tokenType: "role_selection",
      userId: identity.userId,
      businessId: identity.businessId,
      membershipId: identity.membershipId,
      authVersion: identity.authVersion,
      assignedRoles: identity.roles,
    });

    return {
      requiresRoleSelection: true,
      roleSelectionToken,
      roleSelectionExpiresInSeconds: ROLE_SELECTION_TOKEN_EXPIRES_IN_SECONDS,

      user,
      business,

      membership: {
        id: identity.membershipId,
        roles: identity.roles,
      },
    };
  }

  const effectiveRoles = identity.roles;

  const [locationAccess, permissions] = await Promise.all([
    findSessionLocationAccess(
      identity.businessId,
      identity.membershipId,
      effectiveRoles,
    ),

    findPermissionsForRoles(effectiveRoles),
  ]);

  const accessToken = signAccessToken({
    tokenType: "access",
    userId: identity.userId,
    businessId: identity.businessId,
    membershipId: identity.membershipId,
    authVersion: identity.authVersion,
    roles: effectiveRoles,
  });

  return {
    requiresRoleSelection: false,
    authorizationMode: "SINGLE_ROLE",
    accessToken,

    user,
    business,

    membership: {
      id: identity.membershipId,
      roles: effectiveRoles,
      permissions,
    },

    locationAccess,
  };
};

export { login };
export type { DirectLoginResult, LoginResult, PendingRoleSelectionResult };
