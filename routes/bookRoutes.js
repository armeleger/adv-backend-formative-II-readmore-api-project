const express = require('express');
const validateObjectId = require('../middleware/validateObjectId');
const {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
} = require('../controllers/bookController');

const router = express.Router();

router.param('id', validateObjectId('book'));

router.route('/').post(createBook).get(getBooks);
router.route('/:id').get(getBookById).put(updateBook).delete(deleteBook);

module.exports = router;
