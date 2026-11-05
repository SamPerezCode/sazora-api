const resolveEffectiveRoles = (
  requestedRoles: readonly string[],
  assignedRoles: readonly string[],
): string[] | null => {
  const assignedRoleSet = new Set(assignedRoles);
  const effectiveRoles = [...new Set(requestedRoles)];

  if (effectiveRoles.length === 0) {
    return null;
  }

  const containsUnassignedRole = effectiveRoles.some(
    (role) => !assignedRoleSet.has(role),
  );

  if (containsUnassignedRole) {
    return null;
  }

  return effectiveRoles;
};

export { resolveEffectiveRoles };
