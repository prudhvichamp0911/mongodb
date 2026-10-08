require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

let client;
let db;

async function connectDB() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.startsWith('paste-')) {
    throw new Error('MONGODB_URI is not set in .env — paste your Atlas connection string there.');
  }
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  console.log('Connected to MongoDB Atlas');
  db = client.db(process.env.DB_NAME || 'contactsdb');
  return db;
}

function getContactsCollection() {
  if (!db) throw new Error('Database not initialized. Call connectDB() first.');
  return db.collection('contacts');
}

async function closeDB() {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

module.exports = { connectDB, getContactsCollection, closeDB };
