// Aplicación principal
import express from "express";

import { errorHandler } from "./middlewares/error-handler";
import { notFound } from "./middlewares/not-found";
import { apiRouter } from "./routes";

const app = express();

app.use(express.json());

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

export { app };

/*
- notFound responde cuando ninguna ruta coincide.
- errorHandler procesa los errores producidos antes de él.
El orden importa. Los middlewares de errores deben colocarse después de las rutas.
*/
