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
  fixPlaceholderImages,
  upload,
  getCommentsBySlug,
  addCommentById,
  commentAvatarUpload,
  voteOnComment,
  likeComment,
  testLikeComment
} = require('../controllers/blog.controller');

// Public routes
router.get('/', getAllBlogs);
router.get('/categories', getCategories);
router.get('/featured', getFeaturedBlogs);
router.get('/stats', getBlogStats);
router.post('/:id/like', likeBlog);
router.get('/:slug/comments', getCommentsBySlug);
router.post('/:id/comments', commentAvatarUpload.single('avatar'), addCommentById);
router.post('/:blogId/comments/:commentId/vote', voteOnComment);
router.post('/:blogId/comments/:commentId/like', likeComment);
router.post('/:blogId/comments/:commentId/test-like', testLikeComment);
router.get('/:slug', getBlogBySlug);

// Admin routes (you can add authentication middleware here)
router.post('/', upload.single('image'), createBlog);
router.put('/:id', upload.single('image'), updateBlog);
router.delete('/:id', deleteBlog);
router.post('/fix-placeholders', fixPlaceholderImages);

module.exports = router;
