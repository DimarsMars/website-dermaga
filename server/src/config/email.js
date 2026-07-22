const fs = require('fs');
const { Resend } = require('resend');

let resendClient;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is required');
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

/**
 * Compatibility adapter that keeps the existing transporter.sendMail API
 * while sending messages through the Resend HTTPS API.
 */
const transporter = {
  async sendMail({
    from,
    to,
    subject,
    html,
    text,
    attachments = [],
  }) {
    const resendAttachments = await Promise.all(
      attachments.map(async (attachment) => ({
        filename: attachment.filename,
        content: await fs.promises.readFile(attachment.path),
        ...(attachment.cid ? { contentId: attachment.cid } : {}),
      }))
    );

    const { data, error } = await getResendClient().emails.send({
      from: from || process.env.EMAIL_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(resendAttachments.length > 0
        ? { attachments: resendAttachments }
        : {}),
    });

    if (error) {
      const sendError = new Error(error.message || 'Resend failed to send email');
      sendError.details = error;
      throw sendError;
    }

    return data;
  },
};

module.exports = transporter;