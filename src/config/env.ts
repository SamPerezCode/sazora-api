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

  JWT_SECRET: z
    .string()
    .min(64, "JWT_SECRET debe contener al menos 64 caracteres"),

  JWT_EXPIRES_IN: z.enum(["15m", "1h", "8h", "1d", "7d"]).default("8h"),

  SMTP_HOST: z.string().trim().min(1, "SMTP_HOST es obligatoria"),

  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),

  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  SMTP_USER: z.string().trim().min(1, "SMTP_USER es obligatoria"),

  SMTP_PASSWORD: z.string().min(1, "SMTP_PASSWORD es obligatoria"),

  MAIL_FROM_NAME: z.string().trim().min(1, "MAIL_FROM_NAME es obligatoria"),

  MAIL_FROM_ADDRESS: z
    .string()
    .trim()
    .toLowerCase()
    .email("MAIL_FROM_ADDRESS no es válido"),

  PASSWORD_RESET_URL_BASE: z
    .string()
    .url("PASSWORD_RESET_URL_BASE debe ser una URL válida"),

  CLIENT_ORIGIN: z
    .string()
    .url("CLIENT_ORIGIN debe ser una URL válida")
    .default("http://localhost:5173"),
});

const environment = environmentSchema.parse(process.env);

export { environment };
