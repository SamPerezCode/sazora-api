import multer from "multer";

import { AppError } from "../errors/app-error";

const MAXIMUM_IMAGE_SIZE = 5 * 1024 * 1024;

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/octet-stream",
]);

const catalogImageWithFieldsUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAXIMUM_IMAGE_SIZE,
    files: 1,
    fields: 20,
    parts: 21,
    fieldSize: 256 * 1024,
  },

  fileFilter: (_request, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(
        new AppError(
          "La imagen debe ser JPEG, PNG o WebP",
          415,
          "UNSUPPORTED_IMAGE_TYPE",
        ),
      );

      return;
    }

    callback(null, true);
  },
}).single("image");

export { catalogImageWithFieldsUpload };
