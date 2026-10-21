import Logger from "./logger";

export type MailType = "verify" | "resetPassword";

export type MailContexts = {
  verify: {
    name: string;
    verificationLink: string;
  };
  resetPassword: {
    name: string;
    passwordResetLink: string;
  };
};

/**
 * Plug your own mail system in here (e.g. push to your mail worker's queue).
 * Register it once on startup with `setMailSender`.
 */
export type MailSender = <T extends MailType>(
  type: T,
  email: string,
  ctx: MailContexts[T],
) => Promise<void>;

const logOnlySender: MailSender = async (type, email) => {
  Logger.warning(`No mail sender configured. Dropping "${type}" to ${email}`);
};

let sender: MailSender = logOnlySender;

export function setMailSender(newSender: MailSender): void {
  sender = newSender;
}

export async function sendVerificationEmail(
  email: string,
  name: string,
  verificationLink: string,
): Promise<void> {
  await sender("verify", email, { name, verificationLink });
}

export async function sendForgotPasswordEmail(
  email: string,
  name: string,
  passwordResetLink: string,
): Promise<void> {
  await sender("resetPassword", email, { name, passwordResetLink });
}
