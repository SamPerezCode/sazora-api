import type { LocationType } from "../locations/location.types";

type PreparationAreaLocation = Readonly<{
  id: string;
  code: string;
  name: string;
  locationType: LocationType;
  isActive: boolean;
}>;

type PreparationArea = Readonly<{
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  locations: readonly PreparationAreaLocation[];
  createdAt: Date;
  updatedAt: Date;
}>;

type CreatePreparationAreaData = Readonly<{
  name: string;
  description: string | null;
  displayOrder: number;
  locationIds: readonly string[];
}>;

type UpdatePreparationAreaData = Readonly<{
  name: string;
  description: string | null;
  displayOrder: number;

  /*
   * null significa que la actualización no modifica las ubicaciones.
   */
  locationIds: readonly string[] | null;
}>;

export type {
  CreatePreparationAreaData,
  PreparationArea,
  PreparationAreaLocation,
  UpdatePreparationAreaData,
};
