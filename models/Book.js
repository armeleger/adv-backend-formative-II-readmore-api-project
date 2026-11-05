const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
    },
    genre: {
      type: String,
      required: [true, 'Book genre is required'],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Book price is required'],
    },
    publishedYear: {
      type: Number,
      required: [true, 'Book publishedYear is required'],
    },
    // The link to the Author collection. `ref` lets us `populate()` the
    // full author document onto a book when reading.
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Author',
      required: [true, 'Book author (an existing author id) is required'],
    },
  },
  { timestamps: true }
);

// Speeds up "books by author" lookups (GET /authors/:id/books, stats, filters).
bookSchema.index({ author: 1 });

module.exports = mongoose.model('Book', bookSchema);
