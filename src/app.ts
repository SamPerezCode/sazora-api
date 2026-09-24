import { resolve } from "node:path";

import cors from "cors";
import express from "express";

import { environment } from "./config/env";
import { errorHandler } from "./middlewares/error-handler";
import { notFound } from "./middlewares/not-found";
import { apiRouter } from "./routes";

const app = express();

app.use(
  cors({
    origin: environment.CLIENT_ORIGIN,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);

app.use(express.json());

app.use("/uploads", express.static(resolve(process.cwd(), "uploads")));

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

export { app };
