const express = require('express');
const router = express.Router();
const {
  createContact,
  getAllContacts,
  getContact,
  updateContact,
  deleteContact
} = require('../controllers/contact.controller');

// Create a new contact submission
router.post('/', createContact);

// Get all contact submissions
router.get('/', getAllContacts);

// Get a single contact submission
router.get('/:id', getContact);

// Update a contact submission
router.patch('/:id', updateContact);

// Delete a contact submission
router.delete('/:id', deleteContact);

module.exports = router; 