const express = require('express');
const validateObjectId = require('../middleware/validateObjectId');
const {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
  getAuthorBooks,
} = require('../controllers/authorController');

const router = express.Router();

router.param('id', validateObjectId('author'));

router.route('/').post(createAuthor).get(getAuthors);
router.route('/:id').get(getAuthorById).put(updateAuthor).delete(deleteAuthor);
router.get('/:id/books', getAuthorBooks);

module.exports = router;
