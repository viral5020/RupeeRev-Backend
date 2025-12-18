import nodemailer from 'nodemailer';
import logger from '../utils/logger';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const verifyEmailConnection = async () => {
    try {
        await transporter.verify();
        logger.info('SMTP connection established successfully');
        return true;
    } catch (error) {
        logger.error('SMTP connection failed:', error);
        return false;
    }
};

export const sendEmail = async (to: string, subject: string, html: string, attachments?: any[]) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"RupeeRev" <no-reply@rupeerev.com>',
            to,
            subject,
            html,
            attachments,
        });
        logger.info(`Email sent: ${info.messageId}`);
        return info;
    } catch (error) {
        logger.error('Failed to send email:', error);
        throw error;
    }
};
