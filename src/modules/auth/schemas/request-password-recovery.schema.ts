import { z } from "zod";

const requestPasswordRecoverySchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo electrónico no es válido")
      .max(254, "El correo no puede superar 254 caracteres"),
  })
  .strict();

type RequestPasswordRecoveryInput = z.infer<
  typeof requestPasswordRecoverySchema
>;

export { requestPasswordRecoverySchema };
export type { RequestPasswordRecoveryInput };
