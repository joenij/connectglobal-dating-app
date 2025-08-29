const { Pool } = require('pg');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

// Environment-based database configuration
const getEnvironment = () => {
  return process.env.NODE_ENV || 'development';
};

// Database configurations for all environments
const dbConfigs = {
  development: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'connectglobal_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  test: {
    host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || process.env.DB_PORT || 5432,
    database: process.env.TEST_DB_NAME || 'connectglobal_test',
    user: process.env.TEST_DB_USER || process.env.DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
    ssl: false,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 1000,
  },
  production: {
    host: process.env.PROD_DB_HOST || process.env.DB_HOST || 'localhost',
    port: process.env.PROD_DB_PORT || process.env.DB_PORT || 5432,
    database: process.env.PROD_DB_NAME || 'connectglobal_prod',
    user: process.env.PROD_DB_USER || process.env.DB_USER || 'postgres',
    password: process.env.PROD_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
};

// Get current environment config
const dbConfig = dbConfigs[getEnvironment()];

// Create connection pool
const pool = new Pool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    EnterpriseLogger.info('Database connected successfully', null, {
      environment: getEnvironment(),
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