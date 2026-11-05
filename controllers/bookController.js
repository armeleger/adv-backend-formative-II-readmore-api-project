const mongoose = require('mongoose');
const Book = require('../models/Book');
const Author = require('../models/Author');
const pick = require('../utils/pick');

const BOOK_FIELDS = ['title', 'genre', 'price', 'publishedYear', 'author'];

// Fields of the author to embed when populating a book.
const AUTHOR_DETAILS = 'name country bio';

// Compare strings ignoring case (but not accents).
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

// Roughly when the printing press arrived; nothing earlier counts as a "book" here.
const MIN_PUBLISHED_YEAR = 1450;

// Fields GET /books may be sorted by.
const SORTABLE_FIELDS = ['price', 'title', 'publishedYear'];

const notFoundMessage = (id) => ({ message: `No book found with id '${id}'` });

/**
 * Business rules the schema can't enforce on its own. Runs against the
 * book as it *would* be saved (new book, or existing book with the update
 * applied), so create and update share exactly the same checks.
 * Returns { status, message } describing the first broken rule, or null.
 */
const checkBookRules = async (book) => {
  // Rule 3 — Values the schema can't express. Checked first because they
  // need no database round-trip. The year limit is "now", which changes,
  // so it belongs in code rather than as a fixed `max` on the schema.
  const currentYear = new Date().getFullYear();

  if (book.price <= 0) {
    return { status: 422, message: `price must be greater than 0 (received ${book.price})` };
  }

  if (!Number.isInteger(book.publishedYear)) {
    return {
      status: 422,
      message: `publishedYear must be a whole year (received ${book.publishedYear})`,
    };
  }

  if (book.publishedYear < MIN_PUBLISHED_YEAR || book.publishedYear > currentYear) {
    return {
      status: 422,
      message: `publishedYear must be between ${MIN_PUBLISHED_YEAR} and ${currentYear} (received ${book.publishedYear})`,
    };
  }

  // Rule 1 — No orphan books. `required` only checks that *some* ObjectId
  // was given; it never checks that an Author with that id exists.
  if (book.isNew || book.isModified('author')) {
    const authorExists = await Author.exists({ _id: book.author });
    if (!authorExists) {
      return { status: 400, message: `Author '${book.author}' does not exist` };
    }
  }

  // Rule 2 — No duplicate titles *per author*, case-insensitive. Scoping the
  // query to this author means two different authors may share a title.
  // Collation strength 2 compares ignoring case ("the silent sea" = "The Silent Sea").
  if (book.isNew || book.isModified('title') || book.isModified('author')) {
    const duplicate = await Book.findOne({
      _id: { $ne: book._id }, // an updated book must not clash with itself
      author: book.author,
      title: book.title,
    }).collation(CASE_INSENSITIVE);

    if (duplicate) {
      return {
        status: 409,
        message: `This author already has a book titled '${duplicate.title}'`,
      };
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

// Escape regex special characters so user text is matched literally
// (searching "c++" or "(1)" must not break or change the query).
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build the Mongo filter and sort for GET /books from whichever query params
 * are present. Each param adds its own piece to one filter object, so any
 * combination works without writing a query per combination:
 *   ?genre=Thriller                  → { genre: 'Thriller' }
 *   ?minPrice=10                     → { price: { $gte: 10 } }
 *   ?minPrice=10&maxPrice=30         → { price: { $gte: 10, $lte: 30 } }
 *   (no params)                      → {}  (everything)
 * Returns { filter, sort } or { error } for a bad parameter.
 */
const buildBookQuery = (query) => {
  const filter = {};

  // Express gives an array when a param is repeated (?genre=a&genre=b).
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== 'string') return { error: `Query parameter '${key}' must be given once` };
  }

  const { genre, minPrice, maxPrice, author, search, sort, order } = query;

  if (genre) filter.genre = genre; // matched case-insensitively via collation

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    for (const [name, value, operator] of [
      ['minPrice', minPrice, '$gte'],
      ['maxPrice', maxPrice, '$lte'],
    ]) {
      if (value === undefined) continue;
      const number = Number(value);
      if (value.trim() === '' || !Number.isFinite(number)) {
        return { error: `${name} must be a number (received '${value}')` };
      }
      filter.price[operator] = number;
    }
    if (filter.price.$gte > filter.price.$lte) {
      return { error: 'minPrice cannot be greater than maxPrice' };
    }
  }

  if (author !== undefined) {
    if (!mongoose.isValidObjectId(author)) {
      return { error: `author must be a valid author id (received '${author}')` };
    }
    filter.author = author;
  }

  if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' };

  // Sorting: only whitelisted fields; _id as a tie-breaker keeps the order stable.
  const sortSpec = {};
  if (sort !== undefined) {
    if (!SORTABLE_FIELDS.includes(sort)) {
      return { error: `sort must be one of: ${SORTABLE_FIELDS.join(', ')}` };
    }
    const direction = (order || 'asc').toLowerCase();
    if (!['asc', 'desc'].includes(direction)) {
      return { error: "order must be 'asc' or 'desc'" };
    }
    sortSpec[sort] = direction === 'asc' ? 1 : -1;
  }
  sortSpec._id = 1;

  return { filter, sort: sortSpec };
};

// GET /books  — optional: genre, minPrice, maxPrice, author, search, sort, order
const getBooks = async (req, res) => {
  const { filter, sort, error } = buildBookQuery(req.query);
  if (error) return res.status(400).json({ message: error });

  const books = await Book.find(filter)
    .collation(CASE_INSENSITIVE)
    .sort(sort)
    .populate('author', AUTHOR_DETAILS);
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
