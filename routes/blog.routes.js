const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/blog.controller');

// Public routes
router.get('/', getAllBlogs);
router.get('/categories', getCategories);
router.get('/featured', getFeaturedBlogs);
router.get('/stats', getBlogStats);
router.get('/:slug', getBlogBySlug);
router.post('/:id/like', likeBlog);

// Admin routes (you can add authentication middleware here)
router.post('/', upload.single('image'), createBlog);
router.put('/:id', upload.single('image'), updateBlog);
router.delete('/:id', deleteBlog);

module.exports = router;
