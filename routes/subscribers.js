const express = require('express');
const router = express.Router();
const Subscriber = require('../models/Subscriber');

// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if email already exists
    const existingSubscriber = await Subscriber.findOne({ email });
    if (existingSubscriber) {
      return res.status(400).json({ message: 'Email already subscribed' });
    }

    // Create new subscriber
    const subscriber = new Subscriber({ email });
    await subscriber.save();

    res.status(201).json({ 
      message: 'Successfully subscribed to newsletter',
      subscriber 
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ message: 'Error subscribing to newsletter' });
  }
});

// Get all subscribers (admin only)
router.get('/subscribers', async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ subscribedAt: -1 });
    res.json(subscribers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching subscribers' });
  }
});

// Delete subscriber
router.delete('/subscribers/:id', async (req, res) => {
  try {
    const subscriber = await Subscriber.findByIdAndDelete(req.params.id);
    if (!subscriber) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }
    res.json({ message: 'Subscriber deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting subscriber' });
  }
});

// Unsubscribe
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    const subscriber = await Subscriber.findOne({ email });
    
    if (!subscriber) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }

    subscriber.status = 'unsubscribed';
    await subscriber.save();

    res.json({ message: 'Successfully unsubscribed' });
  } catch (error) {
    res.status(500).json({ message: 'Error unsubscribing' });
  }
});

module.exports = router; 