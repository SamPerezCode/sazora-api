import { config } from "dotenv";
import { z } from "zod";

config({ quiet: true });

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DB_HOST: z.string().trim().min(1, "DB_HOST es obligatoria"),

  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),

  DB_NAME: z.string().trim().min(1, "DB_NAME es obligatoria"),

  DB_USER: z.string().trim().min(1, "DB_USER es obligatoria"),

  DB_PASSWORD: z.string().min(1, "DB_PASSWORD es obligatoria"),
});

const environment = environmentSchema.parse(process.env);

export { environment };
