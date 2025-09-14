const Blog = require('../models/blog.model');
const multer = require('multer');
const path = require('path');

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
    let parsedTags = [];
    if (tags) {
      if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags);
        } catch {
          parsedTags = tags.split(',').map(tag => tag.trim());
        }
      } else if (Array.isArray(tags)) {
        parsedTags = tags;
      }
    }
    
    // Parse author properly
    let parsedAuthor = author;
    if (typeof author === 'string') {
      try {
        parsedAuthor = JSON.parse(author);
      } catch (e) {
        console.error('Error parsing author:', e);
        parsedAuthor = {
          name: 'Admin User',
          email: 'admin@sosapient.com',
          image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
        };
      }
    }
    
    let parsedSections = sections;
    if (typeof sections === 'string') {
      try {
        parsedSections = JSON.parse(sections);
      } catch {
        parsedSections = [];
      }
    }
    
    const blog = new Blog({
      title,
      slug,
      excerpt,
      content,
      sections: parsedSections,
      image: imageUrl || 'https://via.placeholder.com/800x400?text=Blog+Image',
      category,
      tags: parsedTags,
      author: parsedAuthor,
      status,
      featured: featured === 'true' || featured === true,
      seo: typeof seo === 'string' ? JSON.parse(seo) : seo
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
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Handle image upload
    if (req.file) {
      updateData.image = `/uploads/blog-images/${req.file.filename}`;
    }
    
    // Parse JSON strings if they exist
    if (updateData.author && typeof updateData.author === 'string') {
      updateData.author = JSON.parse(updateData.author);
    }
    
    if (updateData.seo && typeof updateData.seo === 'string') {
      updateData.seo = JSON.parse(updateData.seo);
    }
    
    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(tag => tag.trim());
    }

    if (updateData.sections && typeof updateData.sections === 'string') {
      try {
        updateData.sections = JSON.parse(updateData.sections);
      } catch {
        updateData.sections = [];
      }
    }
    
    const blog = await Blog.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    });
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Blog post updated successfully',
      data: blog
    });
  } catch (error) {
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
  upload
};
