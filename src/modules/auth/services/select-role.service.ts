import { AppError } from "../../../shared/errors/app-error";
import type { AuthorizationMode, SessionLocationAccess } from "../auth.types";
import { findSessionLocationAccess } from "../repositories/auth-location.repository";
import { findActiveSession } from "../repositories/auth.repository";
import { findPermissionsForRoles } from "../repositories/permission.repository";
import type { SelectRoleInput } from "../schemas/select-role.schema";
import { signAccessToken, verifyRoleSelectionToken } from "./token.service";

type SelectRoleResult = Readonly<{
  accessToken: string;
  authorizationMode: AuthorizationMode;

  membership: {
    id: string;
    assignedRoles: string[];
    effectiveRoles: string[];
    permissions: string[];
  };

  locationAccess: SessionLocationAccess;
}>;

const rolesAreEqual = (
  firstRoles: readonly string[],
  secondRoles: readonly string[],
): boolean => {
  if (firstRoles.length !== secondRoles.length) {
    return false;
  }

  const secondRoleSet = new Set(secondRoles);

  return firstRoles.every((role) => secondRoleSet.has(role));
};

const selectRole = async (
  input: SelectRoleInput,
): Promise<SelectRoleResult> => {
  let selectionTokenPayload;

  try {
    selectionTokenPayload = verifyRoleSelectionToken(input.roleSelectionToken);
  } catch {
    throw new AppError(
      "El token de selección de rol no es válido o ha vencido",
      401,
      "INVALID_ROLE_SELECTION_TOKEN",
    );
  }

  const activeSession = await findActiveSession({
    userId: selectionTokenPayload.userId,
    businessId: selectionTokenPayload.businessId,
    membershipId: selectionTokenPayload.membershipId,
    authVersion: selectionTokenPayload.authVersion,
  });

  if (!activeSession) {
    throw new AppError(
      "La sesión ya no se encuentra activa",
      401,
      "INVALID_ROLE_SELECTION_TOKEN",
    );
  }

  if (
    !rolesAreEqual(selectionTokenPayload.assignedRoles, activeSession.roles)
  ) {
    throw new AppError(
      "Las asignaciones de roles cambiaron. Debes iniciar sesión nuevamente",
      409,
      "ROLE_ASSIGNMENTS_CHANGED",
    );
  }

  let effectiveRoles: string[];

  if (input.mode === "ALL_ROLES") {
    effectiveRoles = activeSession.roles;
  } else {
    const selectedRoleIsAssigned = activeSession.roles.includes(input.role);

    if (!selectedRoleIsAssigned) {
      throw new AppError(
        "El rol seleccionado no está asignado al usuario",
        403,
        "ROLE_NOT_ASSIGNED",
      );
    }

    effectiveRoles = [input.role];
  }

  const [locationAccess, permissions] = await Promise.all([
    findSessionLocationAccess(
      selectionTokenPayload.businessId,
      selectionTokenPayload.membershipId,
      effectiveRoles,
    ),

    findPermissionsForRoles(effectiveRoles),
  ]);

  const accessToken = signAccessToken({
    tokenType: "access",
    userId: selectionTokenPayload.userId,
    businessId: selectionTokenPayload.businessId,
    membershipId: selectionTokenPayload.membershipId,
    authVersion: selectionTokenPayload.authVersion,
    roles: effectiveRoles,
  });

  return {
    accessToken,
    authorizationMode: input.mode,

    membership: {
      id: selectionTokenPayload.membershipId,
      assignedRoles: activeSession.roles,
      effectiveRoles,
      permissions,
    },

    locationAccess,
  };
};

export { selectRole };
export type { SelectRoleResult };
