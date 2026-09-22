type AccessTokenPayload = Readonly<{
  tokenType: "access";
  userId: string;
  businessId: string;
  membershipId: string;
  authVersion: number;
  roles: string[];
}>;

export type { AccessTokenPayload };
