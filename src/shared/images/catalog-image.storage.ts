import { mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, join, resolve } from "node:path";

import sharp from "sharp";

import { AppError } from "../errors/app-error";

const catalogImagesDirectory = resolve(process.cwd(), "uploads", "catalog");

const catalogImagePublicPrefix = "/uploads/catalog/";

const storeCatalogImage = async (imageBuffer: Buffer): Promise<string> => {
  await mkdir(catalogImagesDirectory, {
    recursive: true,
  });

  const fileName = `${randomUUID()}.webp`;
  const absolutePath = join(catalogImagesDirectory, fileName);

  try {
    await sharp(imageBuffer)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: 82,
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

  return `${catalogImagePublicPrefix}${fileName}`;
};

const removeCatalogImage = async (imageUrl: string | null): Promise<void> => {
  if (!imageUrl?.startsWith(catalogImagePublicPrefix)) {
    return;
  }

  const fileName = basename(imageUrl);

  if (!fileName.endsWith(".webp")) {
    return;
  }

  await rm(join(catalogImagesDirectory, fileName), {
    force: true,
  });
};

export { removeCatalogImage, storeCatalogImage };
