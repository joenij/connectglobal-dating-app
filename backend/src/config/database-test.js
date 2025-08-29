const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

let db = null;

// Get test database path
const getDbPath = () => {
  return path.join(__dirname, '../../data/connectglobal_test.db');
};

// Initialize SQLite database for testing
const initializeDatabase = async () => {
  try {
    const dbPath = getDbPath();
    
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    EnterpriseLogger.info('Test SQLite database connected', null, {
      path: dbPath,
      environment: 'test'
    });

    // Create tables if they don't exist
    await createTables();
    
    return true;
  } catch (error) {
    EnterpriseLogger.error('Test database connection failed', error);
    return false;
  }
};

// Create necessary tables
const createTables = async () => {
  try {
    // Users table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        age INTEGER,
        bio TEXT,
        city TEXT,
        country TEXT,
        latitude REAL,
        longitude REAL,
        interests TEXT, -- JSON string for SQLite
        verified INTEGER DEFAULT 0,
        profile_complete INTEGER DEFAULT 0,
        is_test_user INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // User matches table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user1_id INTEGER,
        user2_id INTEGER,
        action TEXT NOT NULL,
        is_match INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user1_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (user2_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user1_id, user2_id)
      )
    `);

    EnterpriseLogger.info('Test database tables created', null, {
      tables: ['users', 'user_matches']
    });

  } catch (error) {
    EnterpriseLogger.error('Failed to create test tables', error);
    throw error;
  }
};

// Query helper function
const query = async (sql, params = []) => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      const rows = await db.all(sql, params);
      return { rows, rowCount: rows.length };
    } else {
      const result = await db.run(sql, params);
      return { 
        rows: result.lastID ? [{ id: result.lastID }] : [],
        rowCount: result.changes || 0 
      };
    }
  } catch (error) {
    EnterpriseLogger.error('Test database query error', error, {
      sql: sql.substring(0, 100),
      params
    });
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  if (!db) {
    throw new Error('Database not initialized');
  }

  try {
    await db.run('BEGIN TRANSACTION');
    const result = await callback(db);
    await db.run('COMMIT');
    return result;
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
};

// Test connection
const testConnection = async () => {
  try {
    if (!db) return false;
    await db.get('SELECT 1');
    return true;
  } catch (error) {
    EnterpriseLogger.error('Test connection failed', error);
    return false;
  }
};

// Close database
const closeDatabase = async () => {
  if (db) {
    await db.close();
    db = null;
    EnterpriseLogger.info('Test database closed', null, {
      environment: 'test'
    });
  }
};

module.exports = {
  query,
  transaction,
  initializeDatabase,
  testConnection,
  closeDatabase
};