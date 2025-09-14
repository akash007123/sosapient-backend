const Career = require('../models/career.model');
const { sendCareerEmail } = require('../utils/emailService');

// Create new career application
const createCareer = async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file);

    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ message: 'Resume file is required' });
    }

    const careerData = {
      ...req.body,
      resume: {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        filename: req.file.originalname
      },
      status: 'pending'
    };

    console.log('Creating career application with data:', {
      ...careerData,
      resume: { ...careerData.resume, data: 'Buffer data...' }
    });

    const career = await Career.create(careerData);
    console.log('Career application created:', {
      ...career.toObject(),
      resume: { ...career.resume, data: 'Buffer data...' }
    });

    // Send email notification
    try {
      await sendCareerEmail(career);
      console.log('Email notification sent successfully');
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      data: {
        ...career.toObject(),
        resume: { ...career.resume, data: undefined } // Don't send file data in response
      }
    });
  } catch (error) {
    console.error('Error creating career application:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Error creating career application'
    });
  }
};

// Get all career applications
const getAllCareers = async (req, res) => {
  try {
    const careers = await Career.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: careers.map(career => ({
        ...career.toObject(),
        resume: { ...career.resume, data: undefined } // Don't send file data in response
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single career application
const getCareer = async (req, res) => {
  try {
    const career = await Career.findById(req.params.id);
    if (!career) {
      return res.status(404).json({
        success: false,
        message: 'Career application not found'
      });
    }
    res.status(200).json({
      success: true,
      data: {
        ...career.toObject(),
        resume: { ...career.resume, data: undefined } // Don't send file data in response
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update career application status
const updateCareer = async (req, res) => {
  try {
    const career = await Career.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!career) {
      return res.status(404).json({
        success: false,
        message: 'Career application not found'
      });
    }
    res.status(200).json({
      success: true,
      data: {
        ...career.toObject(),
        resume: { ...career.resume, data: undefined } // Don't send file data in response
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete career application
const deleteCareer = async (req, res) => {
  try {
    const career = await Career.findByIdAndDelete(req.params.id);
    if (!career) {
      return res.status(404).json({
        success: false,
        message: 'Career application not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Career application deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createCareer,
  getAllCareers,
  getCareer,
  updateCareer,
  deleteCareer
}; 