import { sign, verify, type JwtPayload, type SignOptions } from "jsonwebtoken";
import { z } from "zod";

import { environment } from "../../../config/env";
import type { AccessTokenPayload } from "../auth.types";

const TOKEN_ISSUER = "sazora-api";
const TOKEN_AUDIENCE = "sazora-web";

const accessTokenPayloadSchema = z.object({
  tokenType: z.literal("access"),
  userId: z.string().regex(/^[1-9]\d*$/, "userId debe ser un entero positivo"),
  businessId: z
    .string()
    .regex(/^[1-9]\d*$/, "businessId debe ser un entero positivo"),
  membershipId: z
    .string()
    .regex(/^[1-9]\d*$/, "membershipId debe ser un entero positivo"),
  roles: z.array(z.string().trim().min(1)).min(1),
});

const signAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    algorithm: "HS256",
    audience: TOKEN_AUDIENCE,
    expiresIn: environment.JWT_EXPIRES_IN,
    issuer: TOKEN_ISSUER,
    subject: payload.userId,
  };

  return sign(payload, environment.JWT_SECRET, options);
};

const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decodedToken: string | JwtPayload = verify(
    token,
    environment.JWT_SECRET,
    {
      algorithms: ["HS256"],
      audience: TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
    },
  );

  return accessTokenPayloadSchema.parse(decodedToken);
};

export { signAccessToken, verifyAccessToken };
