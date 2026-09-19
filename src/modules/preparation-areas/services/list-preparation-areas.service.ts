import type { PreparationArea } from "../preparation-area.types";
import { findPreparationAreasByBusinessId } from "../repositories/preparation-area.repository";

const listPreparationAreas = async (
  businessId: string,
): Promise<PreparationArea[]> => findPreparationAreasByBusinessId(businessId);

export { listPreparationAreas };
