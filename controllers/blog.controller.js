const mongoose = require('mongoose');
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
    fileSize: 10 * 1024 * 1024, // Increased from 5MB to 10MB for blog images
    fieldSize: 50 * 1024 * 1024, // Increased from 10MB to 50MB for very long blog content
    fields: 20, // Increased number of allowed fields
    parts: 50 // Increased number of allowed parts
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

// Configure multer for comment avatar uploads
const commentAvatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/comment-avatars/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const commentAvatarUpload = multer({
  storage: commentAvatarStorage,
  limits: {
    fileSize: 3 * 1024 * 1024 // 3MB for avatar
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files are allowed'));
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

// Test endpoint to verify comment like functionality
const testLikeComment = async (req, res) => {
  try {
    console.log('=== TEST LIKE COMMENT ENDPOINT ===');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    
    const { blogId, commentId } = req.params;
    const { userId } = req.body || {};
    
    // Basic validation
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
      return res.status(400).json({ success: false, message: 'Invalid blog ID' });
    }
    
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ success: false, message: 'Invalid comment ID' });
    }
    
    // Find the blog and comment
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    
    const comment = blog.comments.find(c => c._id.toString() === commentId);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    
    console.log('Found comment:', {
      _id: comment._id,
      likeCount: comment.likeCount,
      likedBy: comment.likedBy
    });
    
    return res.json({
      success: true,
      message: 'Test successful',
      data: {
        blog: { _id: blog._id, title: blog.title },
        comment: {
          _id: comment._id,
          likeCount: comment.likeCount || 0,
          likedBy: comment.likedBy || [],
          hasLiked: (comment.likedBy || []).includes(userId)
        }
      }
    });
    
  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: 'Test endpoint error',
      error: error.message
    });
  }
};

// Like/Unlike a specific comment - Simple toggle system
const likeComment = async (req, res) => {
  try {
    const { blogId, commentId } = req.params;
    const { userId } = req.body || {};

    console.log('=== LIKE COMMENT REQUEST ===');
    console.log('Blog ID:', blogId);
    console.log('Comment ID:', commentId);
    console.log('User ID:', userId);

    // Validate required parameters with proper MongoDB ObjectId validation
    if (!blogId || !mongoose.Types.ObjectId.isValid(blogId)) {
      console.log('Invalid blog ID format');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid blog ID format' 
      });
    }
    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
      console.log('Invalid comment ID format');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid comment ID format' 
      });
    }
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      console.log('User ID is required');
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    // Create ObjectIds for proper comparison
    const blogObjectId = new mongoose.Types.ObjectId(blogId);
    const commentObjectId = new mongoose.Types.ObjectId(commentId);

    // Find the blog with the specific comment
    console.log('Finding blog and comment...');
    const blog = await Blog.findOne({
      _id: blogObjectId,
      'comments._id': commentObjectId
    });

    if (!blog) {
      console.log('Blog or comment not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Blog or comment not found' 
      });
    }

    // Find the specific comment in the blog
    const comment = blog.comments.find(c => c._id.toString() === commentId);
    if (!comment) {
      console.log('Comment not found in blog');
      return res.status(404).json({ 
        success: false, 
        message: 'Comment not found in this blog post' 
      });
    }

    console.log('Current comment state:', {
      likeCount: comment.likeCount || 0,
      likedBy: comment.likedBy || []
    });

    // Check if user has already liked this comment
    const hasLiked = Array.isArray(comment.likedBy) && comment.likedBy.includes(userId);
    console.log('User has already liked:', hasLiked);

    let updateOperation;
    let message;
    
    if (hasLiked) {
      // Remove like
      updateOperation = {
        $pull: { 'comments.$.likedBy': userId },
        $inc: { 'comments.$.likeCount': -1 }
      };
      message = 'Comment unliked successfully';
    } else {
      // Add like
      updateOperation = {
        $addToSet: { 'comments.$.likedBy': userId },
        $inc: { 'comments.$.likeCount': 1 }
      };
      message = 'Comment liked successfully';
    }

    console.log('Update operation:', updateOperation);

    // Perform the update
    const updatedBlog = await Blog.findOneAndUpdate(
      {
        _id: blogObjectId,
        'comments._id': commentObjectId
      },
      updateOperation,
      { 
        new: true,
        select: 'comments'
      }
    );

    if (!updatedBlog) {
      console.log('Failed to update blog');
      return res.status(404).json({ 
        success: false, 
        message: 'Failed to update comment' 
      });
    }

    // Find the updated comment
    const updatedComment = updatedBlog.comments.find(c => c._id.toString() === commentId);
    if (!updatedComment) {
      console.log('Updated comment not found');
      return res.status(404).json({ 
        success: false, 
        message: 'Updated comment not found' 
      });
    }

    console.log('Updated comment state:', {
      likeCount: updatedComment.likeCount || 0,
      likedBy: updatedComment.likedBy || []
    });
    
    return res.status(200).json({
      success: true,
      message,
      data: {
        commentId: commentId,
        likeCount: Math.max(0, updatedComment.likeCount || 0),
        isLiked: !hasLiked,
        likedBy: updatedComment.likedBy || []
      }
    });

  } catch (error) {
    console.error('=== ERROR IN LIKE COMMENT ===');
    console.error('Error details:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Handle specific MongoDB errors
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format provided',
        error: 'Invalid ObjectId'
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: error.message
      });
    }

    if (error.name === 'MongoServerError' || error.name === 'MongoError') {
      return res.status(500).json({
        success: false,
        message: 'Database operation failed',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Database error'
      });
    }

    // Generic server error for unexpected issues
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating comment like',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Contact support if this persists'
    });
  }
};

// Vote on a specific comment (like/dislike) identified by its subdocument _id
// Body expects an 'action' field: 'like' | 'unlike' | 'dislike' | 'undislike' | 'switchToLike' | 'switchToDislike'
const voteOnComment = async (req, res) => {
  try {
    const { blogId, commentId } = req.params;
    const { action, voterId } = req.body || {};

    if (!blogId || !blogId.match(/^[0-9a-fA-F]{24}$/) || !commentId || !commentId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid blog or comment ID' });
    }
    if (!voterId || typeof voterId !== 'string' || voterId.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Missing voterId' });
    }

    // Load current comment to determine membership and compute idempotent deltas
    const holder = await Blog.findOne({ _id: blogId, 'comments._id': commentId }, { 'comments.$': 1 }).lean();
    if (!holder || !holder.comments || holder.comments.length === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    const cur = holder.comments[0];
    const hasLiked = Array.isArray(cur.likedBy) && cur.likedBy.includes(voterId);
    const hasDisliked = Array.isArray(cur.dislikedBy) && cur.dislikedBy.includes(voterId);

    let inc = {};
    const update = { $set: {}, $inc: {}, $addToSet: {}, $pull: {} };

    switch (action) {
      case 'like':
        if (!hasLiked) {
          update.$addToSet['comments.$.likedBy'] = voterId;
          update.$inc['comments.$.likeCount'] = 1;
        }
        break;
      case 'unlike':
        if (hasLiked) {
          update.$pull['comments.$.likedBy'] = voterId;
          update.$inc['comments.$.likeCount'] = -1;
        }
        break;
      case 'dislike':
        if (!hasDisliked) {
          update.$addToSet['comments.$.dislikedBy'] = voterId;
          update.$inc['comments.$.dislikeCount'] = 1;
        }
        break;
      case 'undislike':
        if (hasDisliked) {
          update.$pull['comments.$.dislikedBy'] = voterId;
          update.$inc['comments.$.dislikeCount'] = -1;
        }
        break;
      case 'switchToLike':
        if (hasDisliked && !hasLiked) {
          update.$pull['comments.$.dislikedBy'] = voterId;
          update.$addToSet['comments.$.likedBy'] = voterId;
          update.$inc['comments.$.likeCount'] = 1;
          update.$inc['comments.$.dislikeCount'] = -1;
        } else if (!hasLiked) {
          update.$addToSet['comments.$.likedBy'] = voterId;
          update.$inc['comments.$.likeCount'] = 1;
        }
        break;
      case 'switchToDislike':
        if (hasLiked && !hasDisliked) {
          update.$pull['comments.$.likedBy'] = voterId;
          update.$addToSet['comments.$.dislikedBy'] = voterId;
          update.$inc['comments.$.likeCount'] = -1;
          update.$inc['comments.$.dislikeCount'] = 1;
        } else if (!hasDisliked) {
          update.$addToSet['comments.$.dislikedBy'] = voterId;
          update.$inc['comments.$.dislikeCount'] = 1;
        }
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    // Clean empty operators to avoid Mongo errors
    Object.keys(update).forEach(op => { if (Object.keys(update[op]).length === 0) delete update[op]; });

    // If no actual change, return current counts
    if (Object.keys(update).length === 0) {
      return res.json({ success: true, data: { likeCount: cur.likeCount || 0, dislikeCount: cur.dislikeCount || 0 } });
    }

    const updated = await Blog.findOneAndUpdate({ _id: blogId, 'comments._id': commentId }, update, { new: true, projection: { comments: { $elemMatch: { _id: commentId } } } });
    const c = updated.comments[0];
    return res.json({ success: true, data: { likeCount: c.likeCount || 0, dislikeCount: c.dislikeCount || 0 } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error updating comment vote', error: error.message });
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
    
    // Enhanced validation for long content
    if (!title || !excerpt || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title, excerpt, and content are required'
      });
    }
    
    // Validate field lengths with new limits
    if (title.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot exceed 500 characters'
      });
    }
    
    if (excerpt.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Excerpt cannot exceed 1000 characters'
      });
    }
    
    // Content length check (reasonable limit to prevent memory issues)
    if (content.length > 10000000) { // 10MB text limit
      return res.status(400).json({
        success: false,
        message: 'Content is too large. Please reduce the content size.'
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

// Get comments for a blog by slug (only approved comments)
const getCommentsBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Missing blog slug' });
    }

    const blog = await Blog.findOne({ slug, status: 'published' }).select('comments');
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    // Return approved comments sorted by createdAt desc
    const comments = (blog.comments || [])
      .filter(c => c.approved !== false)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching comments', error: error.message });
  }
};

// Add a new comment by blog ID
const addCommentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, comment } = req.body || {};

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid blog ID' });
    }
    if (!name || !email || !comment) {
      return res.status(400).json({ success: false, message: 'Name, email and comment are required' });
    }
    const emailOk = /.+@.+\..+/.test(String(email));
    if (!emailOk) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    // Build new comment
    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      comment: String(comment).trim(),
      approved: true,
      createdAt: new Date()
    };

    // If avatar uploaded, set path
    if (req.file && req.file.filename) {
      newComment.avatar = `/uploads/comment-avatars/${req.file.filename}`;
    }

    const blog = await Blog.findByIdAndUpdate(
      id,
      { $push: { comments: newComment } },
      { new: true, select: 'comments' }
    );

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog post not found' });
    }

    res.status(201).json({ success: true, message: 'Comment added', data: newComment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding comment', error: error.message });
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
  upload,
  commentAvatarUpload,
  getCommentsBySlug,
  addCommentById,
  voteOnComment,
  likeComment,
  testLikeComment
};
