const Book = require('../models/Book');
const pick = require('../utils/pick');

const BOOK_FIELDS = ['title', 'genre', 'price', 'publishedYear', 'author'];

// Fields of the author to embed when populating a book.
const AUTHOR_DETAILS = 'name country bio';

const notFoundMessage = (id) => ({ message: `No book found with id '${id}'` });

// POST /books
const createBook = async (req, res) => {
  const book = await Book.create(pick(req.body, BOOK_FIELDS));
  await book.populate('author', AUTHOR_DETAILS);
  res.status(201).json(book);
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
  const book = await Book.findByIdAndUpdate(req.params.id, pick(req.body, BOOK_FIELDS), {
    returnDocument: 'after',
    runValidators: true,
  }).populate('author', AUTHOR_DETAILS);
  if (!book) return res.status(404).json(notFoundMessage(req.params.id));
  res.json(book);
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
