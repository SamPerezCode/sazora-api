import { environment } from "../../../config/env";
import { mailTransporter } from "../../../shared/mail/mail.transporter";

type SendPasswordRecoveryEmailInput = Readonly<{
  recipientEmail: string;
  resetToken: string;
}>;

const sendPasswordRecoveryEmail = async ({
  recipientEmail,
  resetToken,
}: SendPasswordRecoveryEmailInput): Promise<void> => {
  const resetUrl = new URL(environment.PASSWORD_RESET_URL_BASE);

  resetUrl.searchParams.set("token", resetToken);

  const resetUrlText = resetUrl.toString();

  await mailTransporter.sendMail({
    from: {
      name: environment.MAIL_FROM_NAME,
      address: environment.MAIL_FROM_ADDRESS,
    },
    to: recipientEmail,
    subject: "Recupera tu contraseña de Sazora",
    text: [
      "Recibimos una solicitud para recuperar tu contraseña de Sazora.",
      "",
      "Utiliza el siguiente enlace:",
      resetUrlText,
      "",
      "Token de recuperación:",
      resetToken,
      "",
      "El enlace vence en 30 minutos y solo puede utilizarse una vez.",
      "",
      "Si no solicitaste este cambio, puedes ignorar este mensaje.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h1 style="font-size: 22px;">Recupera tu contraseña</h1>

        <p>
          Recibimos una solicitud para recuperar tu contraseña de Sazora.
        </p>

        <p>
          <a
            href="${resetUrlText}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background-color: #111827;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
            "
          >
            Restablecer contraseña
          </a>
        </p>

        <p>También puedes utilizar este token durante el desarrollo:</p>

        <p
          style="
            padding: 12px;
            background-color: #f3f4f6;
            border-radius: 6px;
            word-break: break-all;
          "
        >
          ${resetToken}
        </p>

        <p>
          El enlace vence en 30 minutos y solo puede utilizarse una vez.
        </p>

        <p>
          Si no solicitaste este cambio, puedes ignorar este mensaje.
        </p>
      </div>
    `,
  });
};

export { sendPasswordRecoveryEmail };
