const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  excerpt: {
    type: String,
    required: true,
    maxlength: 300
  },
  content: {
    type: String,
    required: false
  },
  sections: [{
    heading: { type: String },
    content: { type: String },
    image: { type: String }
  }],
  image: {
    type: String,
    required: true
  },
  author: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    image: {
      type: String,
      default: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1'
    }
  },
  category: {
    type: String,
    required: true,
    enum: ['Technology', 'Design', 'Mobile Development', 'Web Development', 'AI/ML', 'Cybersecurity', 'Business', 'Tutorial']
  },
  tags: [{
    type: String,
    trim: true
  }],
  readTime: {
    type: String,
    default: function() {
      // Calculate read time based on content length (average 200 words per minute)
      const wordCount = this.content.split(' ').length;
      const minutes = Math.ceil(wordCount / 200);
      return `${minutes} min read`;
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  },
  featured: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  }
}, {
  timestamps: true
});

// Set publishedAt when status changes to published
blogSchema.pre('save', function(next) {
  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Index for better search performance
blogSchema.index({ title: 'text', excerpt: 'text', content: 'text' });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ publishedAt: -1 });
blogSchema.index({ slug: 1 });

module.exports = mongoose.model('Blog', blogSchema);
