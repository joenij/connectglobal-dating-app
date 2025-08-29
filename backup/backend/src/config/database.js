const { Pool } = require('pg');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'connectglobal_dev',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    EnterpriseLogger.info('Database connected successfully', null, {
      host: dbConfig.host,
      database: dbConfig.database,
      ssl: !!dbConfig.ssl
    });
    client.release();
    return true;
  } catch (error) {
    EnterpriseLogger.error('Database connection failed', error, {
      host: dbConfig.host,
      database: dbConfig.database
    });
    return false;
  }
};

// Initialize database connection
const initializeDatabase = async () => {
  const isConnected = await testConnection();
  
  if (!isConnected) {
    EnterpriseLogger.info('Database connection tips', null, {
      tips: [
        'Make sure PostgreSQL is installed and running',
        'Create database: createdb connectglobal_dev',
        'Update .env file with correct credentials',
        'Run schema: psql -d connectglobal_dev -f backend/database/schema.sql'
      ]
    });
  }
  
  return isConnected;
};

// Query helper function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    EnterpriseLogger.debug('Query executed', null, {
      query: text.substring(0, 50) + '...',
      duration,
      rows: result.rowCount
    });
    return result;
  } catch (error) {
    EnterpriseLogger.error('Query error', error, {
      query: text,
      message: error.message
    });
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Graceful shutdown
const closeDatabase = async () => {
  await pool.end();
  EnterpriseLogger.info('Database connection pool closed', null, {
    action: 'graceful_shutdown'
  });
};

module.exports = {
  pool,
  query,
  transaction,
  initializeDatabase,
  testConnection,
  closeDatabase
};