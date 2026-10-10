import { z } from "zod";

const nullableText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

const taxResponsibilitySchema = z
  .object({
    code: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(150),
  })
  .strict();

const saveOrganizationFiscalProfileSchema = z
  .object({
    legalName: z.string().trim().min(2).max(200),

    commercialName: nullableText(200),

    personType: z.enum(["NATURAL_PERSON", "LEGAL_ENTITY"]),

    documentType: z.enum(["NIT", "CC", "CE", "PASSPORT", "OTHER"]),

    documentNumber: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .regex(
        /^[A-Za-z0-9-]+$/,
        "El número de identificación contiene caracteres no válidos",
      ),

    verificationDigit: z
      .string()
      .trim()
      .regex(/^[0-9]$/, "El dígito de verificación no es válido")
      .nullable(),

    taxRegimeCode: nullableText(30),
    vatResponsibilityCode: nullableText(30),

    consumptionTaxApplicable: z.boolean(),

    economicActivityCode: nullableText(10),

    fiscalAddress: z.string().trim().min(1).max(250),

    countryCode: z
      .string()
      .trim()
      .length(2)
      .transform((value) => value.toUpperCase()),

    departmentCode: nullableText(5),
    departmentName: z.string().trim().min(1).max(100),

    municipalityCode: nullableText(10),
    municipalityName: z.string().trim().min(1).max(100),

    postalCode: nullableText(12),

    billingEmail: z.string().trim().toLowerCase().email().max(254),
    billingPhone: nullableText(30),

    administrativeContactName: nullableText(150),

    administrativeContactEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email()
      .max(254)
      .nullable(),

    administrativeContactPhone: nullableText(30),

    taxResponsibilities: z
      .array(taxResponsibilitySchema)
      .max(50)
      .superRefine((responsibilities, context) => {
        const codes = responsibilities.map(({ code }) => code);

        if (new Set(codes).size !== codes.length) {
          context.addIssue({
            code: "custom",
            message: "No se pueden repetir responsabilidades fiscales",
          });
        }
      }),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.documentType === "NIT" && data.verificationDigit === null) {
      context.addIssue({
        code: "custom",
        path: ["verificationDigit"],
        message: "El NIT requiere dígito de verificación",
      });
    }
  });

type SaveOrganizationFiscalProfileInput = z.infer<
  typeof saveOrganizationFiscalProfileSchema
>;

export { saveOrganizationFiscalProfileSchema };

export type { SaveOrganizationFiscalProfileInput };
