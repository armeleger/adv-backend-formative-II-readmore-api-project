const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the connection string from the environment.
 * Throws if the connection fails so the server never starts without a database.
 */
const connectDB = async (uri) => {
  if (!uri) {
    throw new Error('MONGO_URI is not defined. Add it to your .env file.');
  }

  const conn = await mongoose.connect(uri);
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
};

module.exports = connectDB;
