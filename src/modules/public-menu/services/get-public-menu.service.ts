import { AppError } from "../../../shared/errors/app-error";
import type { PublicMenu } from "../public-menu.types";
import { findPublicMenuByBusinessSlug } from "../repositories/public-menu.repository";

const getPublicMenu = async (businessSlug: string): Promise<PublicMenu> => {
  const menu = await findPublicMenuByBusinessSlug(businessSlug);

  if (!menu) {
    throw new AppError(
      "El menú público no está disponible",
      404,
      "PUBLIC_MENU_NOT_FOUND",
    );
  }

  return menu;
};

export { getPublicMenu };
