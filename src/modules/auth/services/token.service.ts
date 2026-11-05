import {
  sign,
  verify,
  type JwtPayload,
  type SignOptions,
  type VerifyOptions,
} from "jsonwebtoken";
import { z } from "zod";

import { environment } from "../../../config/env";
import type {
  AccessTokenPayload,
  RoleSelectionTokenPayload,
} from "../auth.types";

const TOKEN_ISSUER = "sazora-api";
const TOKEN_AUDIENCE = "sazora-web";
const ROLE_SELECTION_TOKEN_EXPIRES_IN_SECONDS = 10 * 60;

const positiveIntegerStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Debe ser un entero positivo");

const roleCodeSchema = z.string().trim().min(1);

const accessTokenPayloadSchema = z.object({
  tokenType: z.literal("access"),
  userId: positiveIntegerStringSchema,
  businessId: positiveIntegerStringSchema,
  membershipId: positiveIntegerStringSchema,
  authVersion: z.number().int().positive(),
  roles: z.array(roleCodeSchema).min(1),
});

const roleSelectionTokenPayloadSchema = z.object({
  tokenType: z.literal("role_selection"),
  userId: positiveIntegerStringSchema,
  businessId: positiveIntegerStringSchema,
  membershipId: positiveIntegerStringSchema,
  authVersion: z.number().int().positive(),
  assignedRoles: z.array(roleCodeSchema).min(2),
});

const tokenVerificationOptions: VerifyOptions = {
  algorithms: ["HS256"],
  audience: TOKEN_AUDIENCE,
  issuer: TOKEN_ISSUER,
};

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

const signRoleSelectionToken = (payload: RoleSelectionTokenPayload): string => {
  const options: SignOptions = {
    algorithm: "HS256",
    audience: TOKEN_AUDIENCE,
    expiresIn: ROLE_SELECTION_TOKEN_EXPIRES_IN_SECONDS,
    issuer: TOKEN_ISSUER,
    subject: payload.userId,
  };

  return sign(payload, environment.JWT_SECRET, options);
};

const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decodedToken: string | JwtPayload = verify(
    token,
    environment.JWT_SECRET,
    tokenVerificationOptions,
  );

  return accessTokenPayloadSchema.parse(decodedToken);
};

const verifyRoleSelectionToken = (token: string): RoleSelectionTokenPayload => {
  const decodedToken: string | JwtPayload = verify(
    token,
    environment.JWT_SECRET,
    tokenVerificationOptions,
  );

  return roleSelectionTokenPayloadSchema.parse(decodedToken);
};

export {
  ROLE_SELECTION_TOKEN_EXPIRES_IN_SECONDS,
  signAccessToken,
  signRoleSelectionToken,
  verifyAccessToken,
  verifyRoleSelectionToken,
};
