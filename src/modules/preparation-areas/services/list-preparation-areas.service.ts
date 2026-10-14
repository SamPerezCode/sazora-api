import { AppError } from "../../../shared/errors/app-error";
import { findLocationById } from "../../locations/repositories/location.repository";
import type { PreparationArea } from "../preparation-area.types";
import { findPreparationAreasByBusinessId } from "../repositories/preparation-area.repository";

type ListPreparationAreasOptions = Readonly<{
  locationId?: string;
  activeOnly: boolean;
}>;

const listPreparationAreas = async (
  businessId: string,
  options: ListPreparationAreasOptions,
): Promise<PreparationArea[]> => {
  if (options.locationId !== undefined) {
    const location = await findLocationById(businessId, options.locationId);

    if (!location) {
      throw new AppError("La ubicación no existe", 404, "LOCATION_NOT_FOUND");
    }
  }

  return findPreparationAreasByBusinessId(
    businessId,
    options.locationId,
    options.activeOnly,
  );
};

export { listPreparationAreas };
