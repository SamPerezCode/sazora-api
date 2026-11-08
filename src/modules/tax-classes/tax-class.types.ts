export type TaxType =
  "VAT" | "CONSUMPTION" | "EXEMPT" | "EXCLUDED" | "NON_TAXED" | "OTHER";

export interface TaxRate {
  id: string;
  businessId: string;
  taxClassId: string;
  rate: string;
  validFrom: string;
  validTo: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxClass {
  id: string;
  businessId: string;
  code: string;
  name: string;
  taxType: TaxType;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  rates: TaxRate[];
}

export interface TaxRateInput {
  rate: string;
  validFrom: string;
  validTo: string | null;
}

export interface CreateTaxClassData {
  code: string;
  name: string;
  taxType: TaxType;
  description: string | null;
  initialRate: TaxRateInput;
}

export interface UpdateTaxClassData {
  code?: string;
  name?: string;
  description?: string | null;
}

export interface CreateTaxRateData {
  rate: string;
  validFrom: string;
  validTo: string | null;
}
