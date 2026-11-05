const Author = require('../models/Author');
const Book = require('../models/Book');
const pick = require('../utils/pick');

const AUTHOR_FIELDS = ['name', 'country', 'bio'];

const notFoundMessage = (id) => ({ message: `No author found with id '${id}'` });

// POST /authors
const createAuthor = async (req, res) => {
  const author = await Author.create(pick(req.body, AUTHOR_FIELDS));
  res.status(201).json(author);
};

// GET /authors
const getAuthors = async (req, res) => {
  const authors = await Author.find().sort({ name: 1 });
  res.json(authors);
};

// GET /authors/:id
const getAuthorById = async (req, res) => {
  const author = await Author.findById(req.params.id);
  if (!author) return res.status(404).json(notFoundMessage(req.params.id));
  res.json(author);
};

// PUT /authors/:id
const updateAuthor = async (req, res) => {
  const author = await Author.findByIdAndUpdate(req.params.id, pick(req.body, AUTHOR_FIELDS), {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!author) return res.status(404).json(notFoundMessage(req.params.id));
  res.json(author);
};

// DELETE /authors/:id
//
// Delete policy (Requirement 4): Option A — BLOCK.
// An author who still has books cannot be deleted; the client gets 409 and the
// list of books that must be deleted or moved to another author first.
//
// Why: a bookstore's catalogue is tied to orders, invoices and reviews. Cascading
// would silently destroy records of books that may already have been sold, and
// reassigning would credit books to someone who didn't write them. Blocking
// never loses or falsifies data, and the decision stays with a human.
// Downside: removing a prolific author takes extra steps (deal with each book
// first), and an author can't be removed while any of their books remain.
const deleteAuthor = async (req, res) => {
  const author = await Author.findById(req.params.id);
  if (!author) return res.status(404).json(notFoundMessage(req.params.id));

  const books = await Book.find({ author: author._id }).select('title');
  if (books.length > 0) {
    return res.status(409).json({
      message: `Cannot delete '${author.name}': they still have ${books.length} book(s). Delete or reassign these books first.`,
      books,
    });
  }

  await author.deleteOne();
  res.json({ message: `Author '${author.name}' deleted`, author });
};

// GET /authors/:id/books
const getAuthorBooks = async (req, res) => {
  const author = await Author.findById(req.params.id);
  if (!author) return res.status(404).json(notFoundMessage(req.params.id));

  const books = await Book.find({ author: author._id }).sort({ publishedYear: 1 });
  res.json({ author, count: books.length, books });
};

// GET /authors/:id/stats
//
// With no books there is no average or cheapest book, so those come back as
// null (not 0 — an average price of 0 would wrongly suggest free books) and
// bookCount is 0. The client can always rely on the same response shape.
const getAuthorStats = async (req, res) => {
  const author = await Author.findById(req.params.id);
  if (!author) return res.status(404).json(notFoundMessage(req.params.id));

  // Sorted cheapest → most expensive (title breaks price ties consistently).
  const books = await Book.find({ author: author._id })
    .select('title price')
    .sort({ price: 1, title: 1 });

  if (books.length === 0) {
    return res.json({
      author: author.name,
      bookCount: 0,
      averagePrice: null,
      cheapestBook: null,
      mostExpensiveBook: null,
      message: 'This author has no books yet',
    });
  }

  const totalPrice = books.reduce((sum, book) => sum + book.price, 0);

  res.json({
    author: author.name,
    bookCount: books.length,
    averagePrice: Math.round((totalPrice / books.length) * 100) / 100,
    cheapestBook: books[0].title,
    mostExpensiveBook: books[books.length - 1].title,
  });
};

module.exports = {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
  getAuthorBooks,
  getAuthorStats,
};
