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
    'https://sosapient-backend.onrender.com' // Backend domain (for self-requests)
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (after body parsing to log body content)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Request headers:', req.headers);
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    console.log('Request body:', req.body);
  }
  next();
});

// Serve static files for uploaded images (ensure directory exists)
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
const blogImagesDir = path.join(uploadsDir, 'blog-images');
try {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  if (!fs.existsSync(blogImagesDir)) fs.mkdirSync(blogImagesDir);
} catch (e) {
  console.warn('Warning: could not ensure uploads directories exist:', e.message);
}
app.use('/uploads', express.static(uploadsDir));

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