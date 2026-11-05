const express = require('express');

const app = express();

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'ReadMore API is running' });
});

module.exports = app;
