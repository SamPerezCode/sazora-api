import nodemailer from "nodemailer";

import { environment } from "../../config/env";

const mailTransporter = nodemailer.createTransport({
  host: environment.SMTP_HOST,
  port: environment.SMTP_PORT,
  secure: environment.SMTP_SECURE,
  auth: {
    user: environment.SMTP_USER,
    pass: environment.SMTP_PASSWORD,
  },
});

export { mailTransporter };
