const mailApiUrl = (process.env.MAIL_API_URL || 'http://localhost:3501').replace(/\/$/, '');

export interface MailAttachment {
  filename: string;
  content: string;
  contentType?: string;
  encoding?: string;
}

export const transporter = {
  async sendMail(options: {
    from: string;
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    bcc?: string | string[];
    cc?: string | string[];
    attachments?: MailAttachment[];
  }) {
    const response = await fetch(`${mailApiUrl}/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => response.statusText);
      throw new Error(`mail-api retornou ${response.status}: ${body}`);
    }

    return response.json();
  },
};
