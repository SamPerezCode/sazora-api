import type { AccessTokenPayload } from "../modules/auth/auth.types";

declare module "express-serve-static-core" {
  interface Request {
    auth?: AccessTokenPayload;
  }
}
