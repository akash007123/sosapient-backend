const Contact = require('../models/contact.model');
const { sendContactEmail } = require('../utils/emailService');

// Create new contact submission
exports.createContact = async (req, res) => {
  try {
    const contact = new Contact(req.body);
    await contact.save();

    // Try to send email notification (don't fail if email fails)
    let emailSent = false;
    try {
      await sendContactEmail(contact);
      emailSent = true;
    } catch (emailError) {
      console.error('Email notification failed:', emailError.message);
      // Continue without failing the request
    }

    res.status(201).json({
      success: true,
      message: emailSent 
        ? 'Contact form submitted successfully and email notification sent'
        : 'Contact form submitted successfully (email notification failed)',
      data: contact
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error submitting contact form',
      error: error.message
    });
  }
};

// Get all contact submissions
exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: contacts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching contacts',
      error: error.message
    });
  }
};

// Get single contact submission
exports.getContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching contact',
      error: error.message
    });
  }
};

// Update contact status
exports.updateContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    res.status(200).json({
      success: true,
      data: contact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating contact',
      error: error.message
    });
  }
};

// Delete contact submission
exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting contact',
      error: error.message
    });
  }
}; 