type OrganizationPersonType = "NATURAL_PERSON" | "LEGAL_ENTITY";

type FiscalDocumentType = "NIT" | "CC" | "CE" | "PASSPORT" | "OTHER";

type TaxResponsibility = Readonly<{
  code: string;
  name: string;
}>;

type OrganizationFiscalProfile = Readonly<{
  businessId: string;
  legalName: string;
  commercialName: string | null;
  personType: OrganizationPersonType;
  documentType: FiscalDocumentType;
  documentNumber: string;
  verificationDigit: string | null;
  taxRegimeCode: string | null;
  vatResponsibilityCode: string | null;
  consumptionTaxApplicable: boolean;
  economicActivityCode: string | null;
  fiscalAddress: string;
  countryCode: string;
  departmentCode: string | null;
  departmentName: string;
  municipalityCode: string | null;
  municipalityName: string;
  postalCode: string | null;
  billingEmail: string;
  billingPhone: string | null;
  administrativeContactName: string | null;
  administrativeContactEmail: string | null;
  administrativeContactPhone: string | null;
  taxResponsibilities: readonly TaxResponsibility[];
  createdAt: Date;
  updatedAt: Date;
}>;

type SaveOrganizationFiscalProfileData = Readonly<{
  legalName: string;
  commercialName: string | null;
  personType: OrganizationPersonType;
  documentType: FiscalDocumentType;
  documentNumber: string;
  verificationDigit: string | null;
  taxRegimeCode: string | null;
  vatResponsibilityCode: string | null;
  consumptionTaxApplicable: boolean;
  economicActivityCode: string | null;
  fiscalAddress: string;
  countryCode: string;
  departmentCode: string | null;
  departmentName: string;
  municipalityCode: string | null;
  municipalityName: string;
  postalCode: string | null;
  billingEmail: string;
  billingPhone: string | null;
  administrativeContactName: string | null;
  administrativeContactEmail: string | null;
  administrativeContactPhone: string | null;
  taxResponsibilities: readonly TaxResponsibility[];
}>;

export type {
  FiscalDocumentType,
  OrganizationFiscalProfile,
  OrganizationPersonType,
  SaveOrganizationFiscalProfileData,
  TaxResponsibility,
};
