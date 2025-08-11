const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// SQLite database file path
const dbPath = path.join(__dirname, '../../data/connectglobal.db');

// Create data directory if it doesn't exist
const fs = require('fs');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ SQLite connection failed:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Initialize tables
const initializeTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          phone_number TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          date_of_birth TEXT NOT NULL,
          gender TEXT NOT NULL,
          country_code TEXT NOT NULL,
          gdp_pricing_tier INTEGER DEFAULT 1,
          subscription_tier TEXT DEFAULT 'free',
          is_active BOOLEAN DEFAULT 1,
          is_banned BOOLEAN DEFAULT 0,
          is_phone_verified BOOLEAN DEFAULT 0,
          is_email_verified BOOLEAN DEFAULT 0,
          is_video_verified BOOLEAN DEFAULT 0,
          last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('❌ Failed to create users table:', err.message);
          reject(err);
        } else {
          console.log('✅ Users table ready');
          resolve();
        }
      });
    });
  });
};

// Query helper function (compatible with PostgreSQL style)
const query = (text, params = []) => {
  return new Promise((resolve, reject) => {
    // Convert PostgreSQL-style $1, $2 to SQLite-style ?, ?
    const sqliteQuery = text.replace(/\$(\d+)/g, '?');
    
    db.all(sqliteQuery, params, (err, rows) => {
      if (err) {
        console.error('❌ Query error:', err.message);
        reject(err);
      } else {
        // Mimic PostgreSQL result structure
        resolve({
          rows: rows,
          rowCount: rows.length
        });
      }
    });
  });
};

// Transaction helper (simplified for SQLite)
const transaction = async (callback) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      try {
        const result = callback({
          query: (text, params) => query(text, params)
        });
        db.run('COMMIT');
        resolve(result);
      } catch (error) {
        db.run('ROLLBACK');
        reject(error);
      }
    });
  });
};

// Initialize database
const initializeDatabase = async () => {
  try {
    await initializeTables();
    
    // Initialize matching tables
    const Match = require('../models/Match');
    await Match.initializeTables();
    
    // Initialize video tables
    const Video = require('../models/Video');
    await Video.initializeTables();
    
    // Initialize messaging tables
    const Message = require('../models/Message');
    await Message.initializeTables();
    
    console.log('✅ SQLite database initialized successfully');
    console.log('📝 Note: Using SQLite for development. Install PostgreSQL for production.');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
};

// Test connection
const testConnection = async () => {
  try {
    await query('SELECT 1 as test');
    return true;
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    return false;
  }
};

// Close database
const closeDatabase = () => {
  return new Promise((resolve) => {
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('🔌 SQLite database connection closed');
      }
      resolve();
    });
  });
};

module.exports = {
  db,
  query,
  transaction,
  initializeDatabase,
  testConnection,
  closeDatabase
};