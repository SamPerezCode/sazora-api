import { AppError } from "../../../shared/errors/app-error";
import type { OrganizationFiscalProfile } from "../organization-profile.types";
import {
  findOrganizationFiscalProfile,
  saveOrganizationFiscalProfile,
} from "../repositories/organization-profile.repository";
import type { SaveOrganizationFiscalProfileInput } from "../schemas/organization-profile.schema";

const getOrganizationFiscalProfile = async (
  businessId: string,
): Promise<OrganizationFiscalProfile> => {
  const profile = await findOrganizationFiscalProfile(businessId);

  if (!profile) {
    throw new AppError(
      "El perfil fiscal de la organización aún no ha sido configurado",
      404,
      "ORGANIZATION_FISCAL_PROFILE_NOT_CONFIGURED",
    );
  }

  return profile;
};

const updateOrganizationFiscalProfile = async (
  businessId: string,
  input: SaveOrganizationFiscalProfileInput,
): Promise<OrganizationFiscalProfile> =>
  saveOrganizationFiscalProfile(businessId, input);

export { getOrganizationFiscalProfile, updateOrganizationFiscalProfile };
