import { resolve } from "node:path";

import express from "express";

import { errorHandler } from "./middlewares/error-handler";
import { notFound } from "./middlewares/not-found";
import { apiRouter } from "./routes";

const app = express();

app.use(express.json());

app.use("/uploads", express.static(resolve(process.cwd(), "uploads")));

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

export { app };
