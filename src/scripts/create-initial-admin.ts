import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { z } from "zod";

import { databasePool } from "../database/pool";
import { hashPassword } from "../modules/auth/services/password.service";

const initialAdminSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(1, "El nombre del negocio es obligatorio"),
    businessSlug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "El slug debe utilizar minúsculas, números y guiones",
      ),
    adminFullName: z
      .string()
      .trim()
      .min(1, "El nombre del administrador es obligatorio"),
    adminEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo del administrador no es válido"),
    adminPassword: z
      .string()
      .min(12, "La contraseña debe contener al menos 12 caracteres")
      .refine(
        (password) => Buffer.byteLength(password, "utf8") <= 72,
        "La contraseña supera el límite seguro de 72 bytes",
      ),
    adminPasswordConfirmation: z.string(),
  })
  .refine(
    ({ adminPassword, adminPasswordConfirmation }) =>
      adminPassword === adminPasswordConfirmation,
    {
      message: "Las contraseñas no coinciden",
      path: ["adminPasswordConfirmation"],
    },
  );

type AdminRoleRow = RowDataPacket & {
  roleId: string;
};

const createInitialAdmin = async (): Promise<void> => {
  const input = initialAdminSchema.parse({
    businessName: process.env.INITIAL_BUSINESS_NAME,
    businessSlug: process.env.INITIAL_BUSINESS_SLUG,
    adminFullName: process.env.INITIAL_ADMIN_FULL_NAME,
    adminEmail: process.env.INITIAL_ADMIN_EMAIL,
    adminPassword: process.env.INITIAL_ADMIN_PASSWORD,
    adminPasswordConfirmation: process.env.INITIAL_ADMIN_PASSWORD_CONFIRMATION,
  });

  const passwordHash = await hashPassword(input.adminPassword);
  const connection = await databasePool.getConnection();

  try {
    await connection.beginTransaction();

    const [roleRows] = await connection.execute<AdminRoleRow[]>(
      `
        SELECT CAST(id AS CHAR) AS roleId
        FROM roles
        WHERE code = 'ADMIN' AND is_active = TRUE
        LIMIT 1
      `,
    );

    const adminRole = roleRows[0];

    if (!adminRole) {
      throw new Error(
        "No existe el rol ADMIN activo. Ejecuta primero el seed de roles.",
      );
    }

    const [businessResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO businesses (name, slug)
        VALUES (?, ?)
      `,
      [input.businessName, input.businessSlug],
    );

    const businessId = String(businessResult.insertId);

    const [userResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO users (full_name, email, password_hash)
        VALUES (?, ?, ?)
      `,
      [input.adminFullName, input.adminEmail, passwordHash],
    );

    const userId = String(userResult.insertId);

    const [membershipResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO business_memberships (business_id, user_id)
        VALUES (?, ?)
      `,
      [businessId, userId],
    );

    const membershipId = String(membershipResult.insertId);

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO business_membership_roles (
          business_membership_id,
          role_id
        )
        VALUES (?, ?)
      `,
      [membershipId, adminRole.roleId],
    );

    await connection.commit();

    console.log("Negocio y administrador creados correctamente");
    console.log(`Slug del negocio: ${input.businessSlug}`);
    console.log(`Correo del administrador: ${input.adminEmail}`);
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const run = async (): Promise<void> => {
  try {
    await createInitialAdmin();
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) {
        console.error(`${issue.path.join(".")}: ${issue.message}`);
      }
    } else {
      console.error("No fue posible crear el administrador inicial", error);
    }

    process.exitCode = 1;
  } finally {
    await databasePool.end();
  }
};

void run();
