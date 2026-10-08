require('dotenv').config();
const express = require('express');
const path = require('path');
const { connectDB, closeDB } = require('./db');
const { answerQuestion } = require('./agent');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/query', async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'Body must include a non-empty "question" string.' });
  }

  try {
    const result = await answerQuestion(question.trim());
    res.json(result);
  } catch (err) {
    console.error('Query failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

process.on('SIGINT', async () => {
  await closeDB();
  process.exit(0);
});

start().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});
