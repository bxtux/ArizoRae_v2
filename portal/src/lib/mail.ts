import nodemailer from 'nodemailer';
import { env } from './env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  await transporter.sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM}>`,
    ...opts,
  });
}

export function verificationEmail(link: string, firstName: string) {
  return {
    subject: 'Vérifiez votre adresse email — ArizoRAE',
    text: `Bonjour ${firstName},\n\nCliquez sur ce lien pour vérifier votre email :\n${link}\n\nLe lien expire dans 24 heures.`,
    html: `<p>Bonjour ${firstName},</p><p>Cliquez pour vérifier votre email :</p><p><a href="${link}">Vérifier mon email</a></p><p>Le lien expire dans 24 heures.</p>`,
  };
}

export function resetPasswordEmail(link: string, firstName: string) {
  return {
    subject: 'Réinitialisation du mot de passe — ArizoRAE',
    text: `Bonjour ${firstName},\n\nLien de réinitialisation (expire dans 1h) :\n${link}`,
    html: `<p>Bonjour ${firstName},</p><p><a href="${link}">Réinitialiser mon mot de passe</a></p><p>Le lien expire dans 1 heure.</p>`,
  };
}
