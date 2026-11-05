const mongoose = require('mongoose');
const Book = require('../models/Book');
const Author = require('../models/Author');
const pick = require('../utils/pick');

const BOOK_FIELDS = ['title', 'genre', 'price', 'publishedYear', 'author'];

// Fields of the author to embed when populating a book.
const AUTHOR_DETAILS = 'name country bio';

const notFoundMessage = (id) => ({ message: `No book found with id '${id}'` });

/**
 * Business rules the schema can't enforce on its own. Runs against the
 * book as it *would* be saved (new book, or existing book with the update
 * applied), so create and update share exactly the same checks.
 * Returns { status, message } describing the first broken rule, or null.
 */
const checkBookRules = async (book) => {
  // Rule 1 — No orphan books. `required` only checks that *some* ObjectId
  // was given; it never checks that an Author with that id exists.
  if (book.isNew || book.isModified('author')) {
    const authorExists = await Author.exists({ _id: book.author });
    if (!authorExists) {
      return { status: 400, message: `Author '${book.author}' does not exist` };
    }
  }

  return null;
};

/**
 * Validate the document's shape (400), then the business rules, then save.
 * Sends the error response itself and returns null if anything fails.
 */
const validateAndSave = async (book, req, res) => {
  // An author value that isn't an ObjectId at all is still an orphan → 400.
  const { author } = req.body;
  if (author !== undefined && !mongoose.isValidObjectId(author)) {
    res.status(400).json({ message: `Author '${author}' is not a valid author id` });
    return null;
  }

  await book.validate(); // missing fields / wrong types → 400 via error handler

  const broken = await checkBookRules(book);
  if (broken) {
    res.status(broken.status).json({ message: broken.message });
    return null;
  }

  await book.save();
  return book.populate('author', AUTHOR_DETAILS);
};

// POST /books
const createBook = async (req, res) => {
  const book = new Book(pick(req.body, BOOK_FIELDS));
  const saved = await validateAndSave(book, req, res);
  if (saved) res.status(201).json(saved);
};

// GET /books
const getBooks = async (req, res) => {
  const books = await Book.find().populate('author', AUTHOR_DETAILS);
  res.json(books);
};

// GET /books/:id
const getBookById = async (req, res) => {
  const book = await Book.findById(req.params.id).populate('author', AUTHOR_DETAILS);
  if (!book) return res.status(404).json(notFoundMessage(req.params.id));
  res.json(book);
};

// PUT /books/:id
const updateBook = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json(notFoundMessage(req.params.id));

  book.set(pick(req.body, BOOK_FIELDS));
  const saved = await validateAndSave(book, req, res);
  if (saved) res.json(saved);
};

// DELETE /books/:id
const deleteBook = async (req, res) => {
  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) return res.status(404).json(notFoundMessage(req.params.id));
  res.json({ message: `Book '${book.title}' deleted`, book });
};

module.exports = {
  createBook,
  getBooks,
  getBookById,
  updateBook,
  deleteBook,
};
