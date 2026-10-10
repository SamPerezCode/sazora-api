type LocationType = "PRODUCTION_WAREHOUSE" | "POINT_OF_SALE";

type BusinessLocation = Readonly<{
  id: string;
  businessId: string;
  code: string;
  name: string;
  locationType: LocationType;
  address: string | null;
  countryCode: string;
  departmentCode: string | null;
  departmentName: string | null;
  municipalityCode: string | null;
  municipalityName: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  isInventoryLocation: boolean;
  isProductionLocation: boolean;
  isSalesLocation: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type LocationCapabilities = Readonly<{
  isInventoryLocation: boolean;
  isProductionLocation: boolean;
  isSalesLocation: boolean;
}>;

type CreateLocationData = Readonly<{
  code: string;
  name: string;
  locationType: LocationType;
  address: string | null;
  countryCode: string;
  departmentCode: string | null;
  departmentName: string | null;
  municipalityCode: string | null;
  municipalityName: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
}>;

type UpdateLocationData = CreateLocationData;

export type {
  BusinessLocation,
  CreateLocationData,
  LocationCapabilities,
  LocationType,
  UpdateLocationData,
};
