import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import sharp from "sharp";

import { AppError } from "../errors/app-error";

const businessLogosDirectory = resolve(
  process.cwd(),
  "uploads",
  "business-logos",
);

const businessLogoPublicPrefix = "/uploads/business-logos/";

const storeBusinessLogo = async (imageBuffer: Buffer): Promise<string> => {
  await mkdir(businessLogosDirectory, {
    recursive: true,
  });

  const fileName = `${randomUUID()}.webp`;
  const absolutePath = join(businessLogosDirectory, fileName);

  try {
    await sharp(imageBuffer)
      .rotate()
      .resize({
        width: 1000,
        height: 1000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 86,
      })
      .toFile(absolutePath);
  } catch {
    await rm(absolutePath, {
      force: true,
    });

    throw new AppError(
      "El archivo enviado no contiene una imagen válida",
      400,
      "INVALID_IMAGE_FILE",
    );
  }

  return `${businessLogoPublicPrefix}${fileName}`;
};

const removeBusinessLogo = async (logoUrl: string | null): Promise<void> => {
  if (!logoUrl?.startsWith(businessLogoPublicPrefix)) {
    return;
  }

  const fileName = basename(logoUrl);

  if (!fileName.endsWith(".webp")) {
    return;
  }

  await rm(join(businessLogosDirectory, fileName), {
    force: true,
  });
};

export { removeBusinessLogo, storeBusinessLogo };
