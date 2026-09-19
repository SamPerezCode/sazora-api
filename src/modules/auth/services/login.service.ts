import { AppError } from "../../../shared/errors/app-error";
import type { LoginInput } from "../schemas/login.schema";
import {
  findLoginIdentity,
  updateLastLogin,
} from "../repositories/auth.repository";
import { verifyPassword } from "./password.service";
import { signAccessToken } from "./token.service";

const DUMMY_PASSWORD_HASH =
  "$2b$12$EHvKwFJzIWLC7pSP16OpN.GKtMmH5Gat7aSpbynbnx8p5IdF7OvGq";

type LoginResult = Readonly<{
  accessToken: string;
  user: {
    id: string;
    fullName: string;
  };
  business: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    id: string;
    roles: string[];
  };
}>;

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

  const accessToken = signAccessToken({
    tokenType: "access",
    userId: identity.userId,
    businessId: identity.businessId,
    membershipId: identity.membershipId,
    roles: identity.roles,
  });

  await updateLastLogin(identity.userId);

  return {
    accessToken,
    user: {
      id: identity.userId,
      fullName: identity.fullName,
    },
    business: {
      id: identity.businessId,
      name: identity.businessName,
      slug: identity.businessSlug,
    },
    membership: {
      id: identity.membershipId,
      roles: identity.roles,
    },
  };
};

export { login };
export type { LoginResult };
