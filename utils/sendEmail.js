const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html }) => {
    const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    if (!hasSmtpConfig) {
        console.log(`\n==================================================`);
        console.log(`[SMTP MOCK] Sending email:`);
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content:\n${html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}`);
        console.log(`==================================================\n`);
        return { mock: true };
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_FROM || '"ProInterview AI" <noreply@prointerview.ai>',
        to,
        subject,
        html,
    };

    return await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
