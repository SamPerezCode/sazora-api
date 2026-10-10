import { AppError } from "../../../shared/errors/app-error";
import type {
  BusinessLocation,
  LocationCapabilities,
  LocationType,
  UpdateLocationData,
} from "../location.types";
import {
  findLocationByCode,
  findLocationById,
  findLocations,
  insertLocation,
  updateLocationById,
  updateLocationStatusById,
} from "../repositories/location.repository";
import type {
  CreateLocationInput,
  UpdateLocationInput,
} from "../schemas/location.schema";

const getCapabilities = (locationType: LocationType): LocationCapabilities => {
  if (locationType === "PRODUCTION_WAREHOUSE") {
    return {
      isInventoryLocation: true,
      isProductionLocation: true,
      isSalesLocation: false,
    };
  }

  return {
    isInventoryLocation: true,
    isProductionLocation: false,
    isSalesLocation: true,
  };
};

const listLocations = async (businessId: string): Promise<BusinessLocation[]> =>
  findLocations(businessId);

const getLocation = async (
  businessId: string,
  locationId: string,
): Promise<BusinessLocation> => {
  const location = await findLocationById(businessId, locationId);

  if (!location) {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  return location;
};

const createLocation = async (
  businessId: string,
  input: CreateLocationInput,
): Promise<BusinessLocation> => {
  const existingLocation = await findLocationByCode(businessId, input.code);

  if (existingLocation) {
    throw new AppError(
      "Ya existe una ubicación con ese código",
      409,
      "LOCATION_CODE_ALREADY_EXISTS",
    );
  }

  return insertLocation(
    businessId,
    {
      code: input.code,
      name: input.name,
      locationType: input.locationType,
      address: input.address,
      countryCode: input.countryCode,
      departmentCode: input.departmentCode,
      departmentName: input.departmentName,
      municipalityCode: input.municipalityCode,
      municipalityName: input.municipalityName,
      postalCode: input.postalCode,
      phone: input.phone,
      email: input.email,
    },
    getCapabilities(input.locationType),
  );
};

const updateLocation = async (
  businessId: string,
  locationId: string,
  input: UpdateLocationInput,
): Promise<BusinessLocation> => {
  const current = await findLocationById(businessId, locationId);

  if (!current) {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  const code = input.code ?? current.code;

  if (code !== current.code) {
    const locationWithCode = await findLocationByCode(businessId, code);

    if (locationWithCode && locationWithCode.id !== locationId) {
      throw new AppError(
        "Ya existe una ubicación con ese código",
        409,
        "LOCATION_CODE_ALREADY_EXISTS",
      );
    }
  }

  const data: UpdateLocationData = {
    code,
    name: input.name ?? current.name,
    locationType: input.locationType ?? current.locationType,
    address: input.address === undefined ? current.address : input.address,
    countryCode: input.countryCode ?? current.countryCode,
    departmentCode:
      input.departmentCode === undefined
        ? current.departmentCode
        : input.departmentCode,
    departmentName:
      input.departmentName === undefined
        ? current.departmentName
        : input.departmentName,
    municipalityCode:
      input.municipalityCode === undefined
        ? current.municipalityCode
        : input.municipalityCode,
    municipalityName:
      input.municipalityName === undefined
        ? current.municipalityName
        : input.municipalityName,
    postalCode:
      input.postalCode === undefined ? current.postalCode : input.postalCode,
    phone: input.phone === undefined ? current.phone : input.phone,
    email: input.email === undefined ? current.email : input.email,
  };

  const location = await updateLocationById(
    businessId,
    locationId,
    data,
    getCapabilities(data.locationType),
  );

  if (!location) {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  return location;
};

const updateLocationStatus = async (
  businessId: string,
  locationId: string,
  isActive: boolean,
): Promise<BusinessLocation> => {
  const result = await updateLocationStatusById(
    businessId,
    locationId,
    isActive,
  );

  if (result.kind === "LOCATION_NOT_FOUND") {
    throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
  }

  if (result.kind === "LAST_ACTIVE_LOCATION") {
    throw new AppError(
      "No se puede desactivar la última ubicación activa",
      409,
      "LAST_ACTIVE_LOCATION_CANNOT_BE_DISABLED",
    );
  }

  return result.location;
};

export {
  createLocation,
  getLocation,
  listLocations,
  updateLocation,
  updateLocationStatus,
};
