import { z } from "zod";

import { findActiveSession } from "../../modules/auth/repositories/auth.repository";
import { verifyAccessToken } from "../../modules/auth/services/token.service";
import type { RealtimeSocket } from "../realtime.types";

type RealtimeNext = (error?: Error) => void;

const handshakeAuthenticationSchema = z.object({
  token: z.string().trim().min(1),
});

const createAuthenticationError = (): Error => {
  const error = new Error("Se requiere un token de acceso válido");

  error.name = "AUTHENTICATION_REQUIRED";

  return error;
};

const getBearerToken = (
  authorizationHeader: string | undefined,
): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token, ...remainingParts] = authorizationHeader
    .trim()
    .split(/\s+/);

  if (
    scheme?.toLowerCase() !== "bearer" ||
    !token ||
    remainingParts.length > 0
  ) {
    return null;
  }

  return token;
};

const getHandshakeToken = (socket: RealtimeSocket): string | null => {
  const authenticationResult = handshakeAuthenticationSchema.safeParse(
    socket.handshake.auth,
  );

  if (authenticationResult.success) {
    return authenticationResult.data.token;
  }

  return getBearerToken(socket.handshake.headers.authorization);
};

const authenticateRealtimeConnection = async (
  socket: RealtimeSocket,
  next: RealtimeNext,
): Promise<void> => {
  const token = getHandshakeToken(socket);

  if (!token) {
    next(createAuthenticationError());
    return;
  }

  try {
    const tokenPayload = verifyAccessToken(token);

    const activeSession = await findActiveSession({
      userId: tokenPayload.userId,
      businessId: tokenPayload.businessId,
      membershipId: tokenPayload.membershipId,
      authVersion: tokenPayload.authVersion,
    });

    if (!activeSession) {
      next(createAuthenticationError());
      return;
    }

    socket.data.auth = {
      ...tokenPayload,
      roles: activeSession.roles,
    };

    next();
  } catch {
    next(createAuthenticationError());
  }
};

export { authenticateRealtimeConnection };
