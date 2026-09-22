// Ruta de autenticación
import { Router } from "express";

import {
  changePasswordController,
  getCurrentSessionController,
  loginController,
} from "./controllers/auth.controller";
import { authenticate } from "./middlewares/authenticate.middleware";

const authRouter = Router();

authRouter.post("/login", loginController);

authRouter.get("/session", authenticate, getCurrentSessionController);

authRouter.patch("/password", authenticate, changePasswordController);

export { authRouter };

/*
Esto significa:
- Acepta el método HTTP POST.
- Su ruta local es /login.
- Cuando recibe una petición, ejecuta loginController.
Usamos POST porque enviamos credenciales dentro del cuerpo de la petición. No deben enviarse en la URL.
*/
