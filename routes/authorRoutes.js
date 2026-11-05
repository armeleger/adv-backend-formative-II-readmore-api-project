const express = require('express');
const validateObjectId = require('../middleware/validateObjectId');
const {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
} = require('../controllers/authorController');

const router = express.Router();

router.param('id', validateObjectId('author'));

router.route('/').post(createAuthor).get(getAuthors);
router.route('/:id').get(getAuthorById).put(updateAuthor).delete(deleteAuthor);

module.exports = router;
