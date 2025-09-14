const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const subscriberRoutes = require('./routes/subscribers');

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:5173', // Development
    'http://localhost:3000', // Alternative development port
    'https://sosapient-test.netlify.app', // Production
    'https://sosapient.in',
    'https://staging.sosapient.com', // Staging
    'https://sosapient-backend.onrender.com', // Backend domain (for self-requests)
    'sosapient-backend-mdhx-cy6ftta6r-akash-raikwars-projects.vercel.app'
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true
}));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers);
  if (req.method === 'POST') {
    console.log('Request body:', req.body);
  }
  next();
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
const contactRoutes = require('./routes/contact.routes');
const careerRoutes = require('./routes/career.routes');
const blogRoutes = require('./routes/blog.routes');

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Use routes
app.use('/api/contact', contactRoutes);
app.use('/api/career', careerRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api', subscriberRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Start server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }); 