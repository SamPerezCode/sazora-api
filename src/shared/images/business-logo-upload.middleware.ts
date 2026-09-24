import multer from "multer";

import { AppError } from "../errors/app-error";

const MAXIMUM_LOGO_SIZE = 5 * 1024 * 1024;

const allowedLogoTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/octet-stream",
]);

const businessLogoUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAXIMUM_LOGO_SIZE,
    files: 1,
    fields: 0,
    parts: 1,
  },

  fileFilter: (_request, file, callback) => {
    if (!allowedLogoTypes.has(file.mimetype)) {
      callback(
        new AppError(
          "El logo debe ser JPEG, PNG o WebP",
          415,
          "UNSUPPORTED_LOGO_TYPE",
        ),
      );

      return;
    }

    callback(null, true);
  },
}).single("image");

export { businessLogoUpload };
