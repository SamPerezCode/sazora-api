const getBusinessRoom = (businessId: string): string =>
  `business:${businessId}`;

const getMembershipRoom = (membershipId: string): string =>
  `membership:${membershipId}`;

const getBusinessRoleRoom = (businessId: string, role: string): string =>
  `business:${businessId}:role:${role}`;

export { getBusinessRoleRoom, getBusinessRoom, getMembershipRoom };
