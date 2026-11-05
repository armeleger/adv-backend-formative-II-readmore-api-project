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
const deleteAuthor = async (req, res) => {
  const author = await Author.findByIdAndDelete(req.params.id);
  if (!author) return res.status(404).json(notFoundMessage(req.params.id));
  res.json({ message: `Author '${author.name}' deleted`, author });
};

// GET /authors/:id/books
const getAuthorBooks = async (req, res) => {
  const author = await Author.findById(req.params.id);
  if (!author) return res.status(404).json(notFoundMessage(req.params.id));

  const books = await Book.find({ author: author._id }).sort({ publishedYear: 1 });
  res.json({ author, count: books.length, books });
};

module.exports = {
  createAuthor,
  getAuthors,
  getAuthorById,
  updateAuthor,
  deleteAuthor,
  getAuthorBooks,
};
