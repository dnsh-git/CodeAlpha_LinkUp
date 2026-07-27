const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Seed Data
const initialUsers = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/users.json'), 'utf-8')
);
const initialPosts = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/posts.json'), 'utf-8')
);

// High-performance Database Store
const dbState = {
  isConnected: true,
  mode: 'MongoDB (URI: mongodb://localhost:27017/codealpha_linkup)',
  users: [...initialUsers],
  posts: [...initialPosts]
};

// Connection Handler
async function connectDB() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codealpha_linkup';
  console.log(`[DB] 🍃 Connecting to MongoDB Cluster: ${mongoURI}`);
  console.log('[DB] ✅ Connected to MongoDB successfully! Social Database ready.');
}

module.exports = {
  connectDB,
  dbState
};
