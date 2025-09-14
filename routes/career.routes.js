const express = require('express');
const router = express.Router();
const {
  createCareer,
  getAllCareers,
  getCareer,
  updateCareer,
  deleteCareer
} = require('../controllers/career.controller');
const { upload, handleMulterError } = require('../middleware/upload');
const Career = require('../models/career.model');

// Create new career application
router.post('/', upload.single('resume'), handleMulterError, createCareer);

// Get all career applications
router.get('/', getAllCareers);

// Get single career application
router.get('/:id', getCareer);

// Get resume file
router.get('/:id/resume', async (req, res) => {
  try {
    const career = await Career.findById(req.params.id);
    if (!career) {
      return res.status(404).json({
        success: false,
        message: 'Career application not found'
      });
    }

    if (!career.resume || !career.resume.data) {
      return res.status(404).json({
        success: false,
        message: 'Resume not found'
      });
    }

    res.set('Content-Type', career.resume.contentType);
    res.set('Content-Disposition', `attachment; filename="${career.resume.filename}"`);
    res.send(career.resume.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update career application status
router.patch('/:id', updateCareer);

// Delete career application
router.delete('/:id', deleteCareer);

module.exports = router; 