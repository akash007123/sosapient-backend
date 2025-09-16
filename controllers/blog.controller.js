const Blog = require('../models/blog.model');
const multer = require('multer');
const path = require('path');

// Helper to normalize any input into an array of trimmed strings
function normalizeStringArray(input) {
  if (!input) return [];
  let arr = [];
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) arr = parsed;
      else arr = String(input).split(',');
    } catch {
      arr = String(input).split(',');
    }
  } else if (Array.isArray(input)) {
    arr = input;
  } else if (typeof input === 'object') {
    // Convert object values to array if needed
    arr = Object.values(input);
  }
  return arr
    .map(v => (v == null ? '' : String(v)))
    .map(v => v.trim())
    .filter(v => v.length > 0);
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/blog-images/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'blog-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    fieldSize: 10 * 1024 * 1024 // 10MB limit for field values
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get all published blogs with pagination and filtering
const getAllBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const { category, search, featured, author } = req.query;
    
    // Build filter object
    const filter = { status: 'published' };
    
    if (category && category !== 'All') {
      filter.category = category;
    }
    
    if (featured === 'true') {
      filter.featured = true;
    }
    
    if (author) {
      filter['author.name'] = new RegExp(author, 'i');
    }
    
    if (search) {
      filter.$text = { $search: search };
    }
    
    const blogs = await Blog.find(filter)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Blog.countDocuments(filter);
    
    res.json({
      success: true,
      data: blogs,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalBlogs: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error in getAllBlogs:', error); // Added detailed logging
    res.status(500).json({
      success: false,
      message: 'Error fetching blogs',
      error: error.message
    });
  }
};

// Get single blog by slug
const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const blog = await Blog.findOne({ slug, status: 'published' });
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    // Increment views
    await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });
    
    res.json({
      success: true,
      data: blog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching blog',
      error: error.message
    });
  }
};

// Create new blog post
const createBlog = async (req, res) => {
  try {
    console.log('Creating blog with data:', req.body);
    
    const {
      title,
      excerpt,
      content,
      category,
      tags,
      author,
      status = 'published',
      featured = false,
      seo,
      sections = []
    } = req.body;
    
    // Validate required fields
    if (!title || !excerpt || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title, excerpt, and content are required'
      });
    }
    
    // Handle image upload
    let imageUrl = req.body.image;
    if (req.file) {
      imageUrl = `/uploads/blog-images/${req.file.filename}`;
    }
    
    // Generate unique slug
    let baseSlug = title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .trim();
    
    let slug = baseSlug;
    let counter = 1;
    
    // Check for existing slug and make it unique
    while (await Blog.findOne({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    // Parse tags properly
    let parsedTags = normalizeStringArray(tags);
    // CSV fallback if tags couldn't be parsed from main field
    if (parsedTags.length === 0 && typeof req.body.tagsCsv === 'string') {
      parsedTags = normalizeStringArray(req.body.tagsCsv);
    }
    console.log('Final parsed tags:', parsedTags);
    
    // Parse author properly
    let parsedAuthor = author;
    console.log('=== CREATE BLOG AUTHOR PROCESSING ===');
    console.log('Raw author received:', author, 'Type:', typeof author);
    
    if (author !== undefined && author !== null) {
      if (typeof author === 'string') {
        try {
          parsedAuthor = JSON.parse(author);
          console.log('JSON parsed author:', parsedAuthor);
        } catch (e) {
          console.error('Error parsing author:', e);
          // If it's a plain string, treat it as author name
          parsedAuthor = {
            name: author,
            email: 'admin@sosapient.com',
            image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
          };
          console.log('Created author from string:', parsedAuthor);
        }
      } else if (typeof author === 'object') {
        parsedAuthor = author;
        console.log('Author already object:', parsedAuthor);
      }
    } else {
      console.log('Author is undefined/null, setting default');
      parsedAuthor = {
        name: 'Admin User',
        email: 'admin@sosapient.com',
        image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
      };
    }
    
    // Ensure author has required fields
    if (!parsedAuthor.name) parsedAuthor.name = 'Admin User';
    if (!parsedAuthor.email) parsedAuthor.email = 'admin@sosapient.com';
    if (!parsedAuthor.image) parsedAuthor.image = 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1';
    
    console.log('Final parsed author:', parsedAuthor);
    
    let parsedSections = sections;
    if (typeof sections === 'string') {
      try {
        parsedSections = JSON.parse(sections);
      } catch {
        parsedSections = [];
      }
    }
    
    // Parse SEO properly
    let parsedSeo = seo || { metaTitle: '', metaDescription: '', keywords: [] };
    console.log('=== CREATE BLOG SEO PROCESSING ===');
    console.log('Raw seo received:', seo, 'Type:', typeof seo);
    
    if (seo !== undefined && seo !== null) {
      if (typeof seo === 'string') {
        try {
          parsedSeo = JSON.parse(seo);
          console.log('JSON parsed seo:', parsedSeo);
        } catch (error) {
          console.log('SEO JSON parse failed:', error.message);
          parsedSeo = { metaTitle: '', metaDescription: '', keywords: [] };
        }
      } else if (typeof seo === 'object') {
        parsedSeo = seo;
        console.log('SEO already object:', parsedSeo);
      }
    } else {
      console.log('SEO is undefined/null, setting default');
      parsedSeo = { metaTitle: '', metaDescription: '', keywords: [] };
    }

    // Normalize SEO keywords array
    parsedSeo.keywords = normalizeStringArray(parsedSeo.keywords);
    // CSV fallback for SEO keywords
    if ((!Array.isArray(parsedSeo.keywords) || parsedSeo.keywords.length === 0) && typeof req.body.seoKeywordsCsv === 'string') {
      parsedSeo.keywords = normalizeStringArray(req.body.seoKeywordsCsv);
    }
    
    const blog = new Blog({
      title,
      slug,
      excerpt,
      content,
      sections: parsedSections,
      image: imageUrl || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=400&fit=crop&crop=center',
      category,
      tags: parsedTags,
      author: parsedAuthor,
      status,
      featured: featured === 'true' || featured === true,
      seo: parsedSeo
    });
    
    await blog.save();
    
    res.status(201).json({
      success: true,
      message: 'Blog post created successfully',
      data: blog
    });
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating blog post',
      error: error.message
    });
  }
};

// Update blog post
const updateBlog = async (req, res) => {
  try {
    console.log('=== UPDATE BLOG REQUEST ===');
    console.log('Blog ID:', req.params.id);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request files:', req.files);
    console.log('=== BACKEND UPDATE RECEIVED DATA ===');
    console.log('req.body.tags:', req.body.tags);
    console.log('req.body.seo:', req.body.seo);
    console.log('req.body.author:', req.body.author);

    console.log('File uploaded:', req.file ? req.file.filename : 'No file');
    
    const { id } = req.params;
    
    // Validate blog ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('Invalid blog ID format:', id);
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID format'
      });
    }
    
    const updateData = { ...req.body };
    
    // Handle image upload
    if (req.file) {
      updateData.image = `/uploads/blog-images/${req.file.filename}`;
    }
    
    // Parse JSON strings if they exist with better error handling
    try {
      if (updateData.author && typeof updateData.author === 'string') {
        console.log('=== UPDATE BLOG AUTHOR PROCESSING ===');
        console.log('Raw author received:', updateData.author, 'Type:', typeof updateData.author);
        
        try {
          updateData.author = JSON.parse(updateData.author);
          console.log('JSON parsed author:', updateData.author);
        } catch (parseError) {
          console.log('JSON parse failed, treating as author name:', parseError.message);
          // If it's a plain string, treat it as author name
          updateData.author = {
            name: updateData.author,
            email: 'admin@sosapient.com',
            image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
          };
          console.log('Created author from string:', updateData.author);
        }
        
        // Ensure author has required fields
        if (typeof updateData.author === 'object') {
          if (!updateData.author.name) updateData.author.name = 'Admin User';
          if (!updateData.author.email) updateData.author.email = 'admin@sosapient.com';
          if (!updateData.author.image) updateData.author.image = 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1';
        }
        
        console.log('Final parsed author:', updateData.author);
      }
    } catch (error) {
      console.error('Error processing author:', error.message);
      // Don't fail the entire update for author issues, just use default
      updateData.author = {
        name: 'Admin User',
        email: 'admin@sosapient.com',
        image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
      };
      console.log('Using default author due to error');
    }
    
    try {
      if (updateData.seo && typeof updateData.seo === 'string') {
        console.log('Parsing SEO:', updateData.seo);
        // Check if it's already a valid JSON string or if it's "[object Object]"
        if (updateData.seo === '[object Object]' || updateData.seo.startsWith('[object')) {
          console.log('Skipping invalid SEO object string');
          delete updateData.seo;
        } else {
          updateData.seo = JSON.parse(updateData.seo);
        }
      }
    } catch (error) {
      console.error('Error parsing SEO:', error.message);
      console.log('Skipping invalid SEO data and continuing...');
      delete updateData.seo; // Remove invalid SEO data instead of failing
    }

    // Normalize SEO keywords if present
    if (updateData.seo && typeof updateData.seo === 'object') {
      updateData.seo.keywords = normalizeStringArray(updateData.seo.keywords);
      if ((!Array.isArray(updateData.seo.keywords) || updateData.seo.keywords.length === 0) && typeof updateData.seoKeywordsCsv === 'string') {
        updateData.seo.keywords = normalizeStringArray(updateData.seoKeywordsCsv);
      }
    }
    
    // Handle tags parsing
    if (updateData.tags !== undefined) {
      updateData.tags = normalizeStringArray(updateData.tags);
      if (updateData.tags.length === 0 && typeof updateData.tagsCsv === 'string') {
        updateData.tags = normalizeStringArray(updateData.tagsCsv);
      }
    } else {
      console.log('No tags field in updateData');
    }

    // Handle sections parsing
    if (updateData.sections && typeof updateData.sections === 'string') {
      try {
        console.log('Parsing sections:', updateData.sections);
        updateData.sections = JSON.parse(updateData.sections);
      } catch (error) {
        console.error('Error parsing sections:', error.message);
        return res.status(400).json({
          success: false,
          message: 'Invalid sections data format',
          error: error.message
        });
      }
    }
    
    // Handle boolean fields
    if (updateData.featured !== undefined) {
      updateData.featured = updateData.featured === 'true' || updateData.featured === true;
    }
    
    // Handle slug generation if title is being updated
    if (updateData.title) {
      // Get current blog to check if title actually changed
      const currentBlog = await Blog.findById(id).select('title slug');
      
      if (!currentBlog) {
        return res.status(404).json({
          success: false,
          message: 'Blog post not found'
        });
      }
      
      // Only regenerate slug if title actually changed
      if (currentBlog.title !== updateData.title) {
        let baseSlug = updateData.title
          .toLowerCase()
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '-')
          .trim();
        
        let slug = baseSlug;
        let counter = 1;
        
        // Check for existing slug and make it unique (exclude current blog)
        while (await Blog.findOne({ slug, _id: { $ne: id } })) {
          slug = `${baseSlug}-${counter}`;
          counter++;
        }
        
        updateData.slug = slug;
        console.log('Generated new slug:', slug);
      }
    }
    
    // Remove undefined fields to avoid validation issues, but preserve tags and seo even if empty
    Object.keys(updateData).forEach(key => {
      if (key === 'tags' || key === 'seo') {
        // Keep tags and seo fields even if empty
        return;
      }
      if (updateData[key] === undefined || updateData[key] === null || updateData[key] === '') {
        delete updateData[key];
      }
    });
    
    console.log('Final update data:', updateData);
    
    const blog = await Blog.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });
    
    if (!blog) {
      console.log('Blog not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    console.log('Blog updated successfully:', blog._id);
    res.json({
      success: true,
      message: 'Blog post updated successfully',
      data: blog
    });
  } catch (error) {
    console.error('Error updating blog post:', error);
    console.error('Error stack:', error.stack);
    
    // Check for validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors,
        error: error.message
      });
    }
    
    // Check for cast errors (invalid ObjectId)
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid blog ID',
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      message: 'Error updating blog post',
      error: error.message
    });
  }
};

// Delete blog post
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findByIdAndDelete(id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Blog post deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting blog post',
      error: error.message
    });
  }
};

// Get blog categories
const getCategories = async (req, res) => {
  try {
    const categories = await Blog.distinct('category', { status: 'published' });
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

// Get featured blogs
const getFeaturedBlogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    
    const blogs = await Blog.find({ 
      status: 'published', 
      featured: true 
    })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean();
    
    res.json({
      success: true,
      data: blogs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching featured blogs',
      error: error.message
    });
  }
};

// Like a blog post
const likeBlog = async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findByIdAndUpdate(
      id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Blog liked successfully',
      data: { likes: blog.likes }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error liking blog post',
      error: error.message
    });
  }
};

// Get blog statistics
const getBlogStats = async (req, res) => {
  try {
    const totalBlogs = await Blog.countDocuments({ status: 'published' });
    const totalViews = await Blog.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: null, totalViews: { $sum: '$views' } } }
    ]);
    
    const categoryStats = await Blog.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        totalBlogs,
        totalViews: totalViews[0]?.totalViews || 0,
        categoryStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching blog statistics',
      error: error.message
    });
  }
};

// Fix placeholder images in existing blogs
const fixPlaceholderImages = async (req, res) => {
  try {
    console.log('Starting placeholder image fix...');
    
    // Find blogs with via.placeholder.com images
    const blogsWithPlaceholders = await Blog.find({
      $or: [
        { image: { $regex: 'via.placeholder.com', $options: 'i' } },
        { 'author.image': { $regex: 'via.placeholder.com', $options: 'i' } }
      ]
    });
    
    console.log(`Found ${blogsWithPlaceholders.length} blogs with placeholder images`);
    
    let updatedCount = 0;
    
    for (const blog of blogsWithPlaceholders) {
      const updates = {};
      
      // Fix main image
      if (blog.image && blog.image.includes('via.placeholder.com')) {
        updates.image = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=400&fit=crop&crop=center';
      }
      
      // Fix author image
      if (blog.author?.image && blog.author.image.includes('via.placeholder.com')) {
        updates['author.image'] = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face';
      }
      
      if (Object.keys(updates).length > 0) {
        await Blog.findByIdAndUpdate(blog._id, updates);
        updatedCount++;
        console.log(`Updated blog: ${blog.title}`);
      }
    }
    
    res.json({
      success: true,
      message: `Fixed ${updatedCount} blogs with placeholder images`,
      data: { updatedCount, totalFound: blogsWithPlaceholders.length }
    });
  } catch (error) {
    console.error('Error fixing placeholder images:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing placeholder images',
      error: error.message
    });
  }
};

module.exports = {
  getAllBlogs,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  getCategories,
  getFeaturedBlogs,
  likeBlog,
  getBlogStats,
  fixPlaceholderImages,
  upload
};
