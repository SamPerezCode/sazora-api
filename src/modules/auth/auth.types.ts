type AccessTokenPayload = Readonly<{
  tokenType: "access";
  userId: string;
  businessId: string;
  membershipId: string;
  roles: string[];
}>;

export type { AccessTokenPayload };
