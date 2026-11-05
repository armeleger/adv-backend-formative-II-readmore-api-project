/**
 * Reset the database with sample authors and books for testing / demos.
 * Usage: npm run seed   (WARNING: deletes all existing authors and books)
 */
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Author = require('../models/Author');
const Book = require('../models/Book');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Book.deleteMany({}), Author.deleteMany({})]);

  const [achebe, adichie, ngugi, emptyAuthor] = await Author.create([
    { name: 'Chinua Achebe', country: 'Nigeria', bio: 'Novelist, poet and critic.' },
    { name: 'Chimamanda Ngozi Adichie', country: 'Nigeria', bio: 'Author of novels and essays.' },
    { name: 'Ngugi wa Thiong\'o', country: 'Kenya', bio: 'Novelist and playwright.' },
    { name: 'New Author', country: 'Rwanda', bio: 'Has not published any books yet.' },
  ]);

  await Book.create([
    { title: 'Things Fall Apart', genre: 'Fiction', price: 14.99, publishedYear: 1958, author: achebe._id },
    { title: 'No Longer at Ease', genre: 'Fiction', price: 18.5, publishedYear: 1960, author: achebe._id },
    { title: 'Arrow of God', genre: 'Fiction', price: 22.0, publishedYear: 1964, author: achebe._id },
    { title: 'Anthills of the Savannah', genre: 'Political Fiction', price: 30.5, publishedYear: 1987, author: achebe._id },
    { title: 'Half of a Yellow Sun', genre: 'Historical Fiction', price: 24.99, publishedYear: 2006, author: adichie._id },
    { title: 'Americanah', genre: 'Fiction', price: 19.99, publishedYear: 2013, author: adichie._id },
    { title: 'Purple Hibiscus', genre: 'Fiction', price: 12.0, publishedYear: 2003, author: adichie._id },
    { title: 'Petals of Blood', genre: 'Political Fiction', price: 21.0, publishedYear: 1977, author: ngugi._id },
    { title: 'A Grain of Wheat', genre: 'Historical Fiction', price: 16.75, publishedYear: 1967, author: ngugi._id },
    { title: 'The Silent Sea', genre: 'Thriller', price: 24.99, publishedYear: 2021, author: ngugi._id },
  ]);

  console.log(`Seeded 4 authors and 10 books. Author with no books: ${emptyAuthor._id}`);
  await mongoose.disconnect();
};

seed().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
