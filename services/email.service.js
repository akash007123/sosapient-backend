const nodemailer = require('nodemailer');

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Send contact form email
const sendContactEmail = async (contact) => {
  try {
    // Email to admin
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.ADMIN_EMAIL,
      subject: `New Contact Form Submission: ${contact.subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${contact.name}</p>
        <p><strong>Email:</strong> ${contact.email}</p>
        ${contact.company ? `<p><strong>Company:</strong> ${contact.company}</p>` : ''}
        ${contact.phone ? `<p><strong>Phone:</strong> ${contact.phone}</p>` : ''}
        <p><strong>Subject:</strong> ${contact.subject}</p>
        ${contact.budget ? `<p><strong>Budget:</strong> ${contact.budget}</p>` : ''}
        ${contact.timeline ? `<p><strong>Timeline:</strong> ${contact.timeline}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${contact.message}</p>
      `
    });

    // Confirmation email to user
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: contact.email,
      subject: 'Thank you for contacting us',
      html: `
        <h2>Thank you for contacting us!</h2>
        <p>Dear ${contact.name},</p>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p>Here's a copy of your message:</p>
        <p><strong>Subject:</strong> ${contact.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${contact.message}</p>
        <p>Best regards,<br>Your Company Name</p>
      `
    });

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email notification');
  }
};

module.exports = {
  sendContactEmail
}; 