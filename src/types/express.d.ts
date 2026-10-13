import type { AuthenticatedSession } from "../modules/auth/auth.types";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthenticatedSession;
  }
}
