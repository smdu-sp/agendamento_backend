import * as nodemailer from 'nodemailer';

const mailHost = process.env.MAIL_HOST || process.env.SMTP_HOST;
const mailPort = process.env.MAIL_PORT || process.env.SMTP_PORT;
const mailUser = process.env.MAIL_USER || process.env.SMTP_USER;
const mailPass = process.env.MAIL_PASS || process.env.SMTP_PASS;
const mailSecure =
  (process.env.MAIL_SECURE || process.env.SMTP_SECURE || 'false').toLowerCase() ===
  'true';

if (!mailHost || !mailPort || !mailUser || !mailPass) {
  throw new Error(
    'As variáveis de ambiente do SMTP não estão definidas corretamente. Configure MAIL_HOST, MAIL_PORT, MAIL_USER e MAIL_PASS.',
  );
}

export const transporter = nodemailer.createTransport({
  host: mailHost,
  port: Number(mailPort),
  secure: mailSecure,
  auth: {
    user: mailUser,
    pass: mailPass,
  },
});
