const express = require('express');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'ReadMore API is running' });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
