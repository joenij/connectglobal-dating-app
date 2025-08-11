const path = require('path');

// Test SQLite database setup
async function testDatabase() {
  try {
    console.log('🧪 Testing SQLite database setup...');
    
    // Import the SQLite database module
    const { initializeDatabase, query, testConnection } = require('./backend/src/config/database-sqlite');
    
    // Initialize database
    console.log('📦 Initializing database...');
    const initialized = await initializeDatabase();
    
    if (!initialized) {
      console.error('❌ Database initialization failed');
      return;
    }
    
    // Test connection
    console.log('🔗 Testing connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('❌ Database connection test failed');
      return;
    }
    
    // Test creating a user
    console.log('👤 Testing user creation...');
    const testUser = {
      email: 'test@connectglobal.app',
      phoneNumber: '+1234567890',
      passwordHash: '$2a$12$test.hash.here',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1995-01-01',
      gender: 'male',
      countryCode: 'US',
      gdpPricingTier: 1
    };
    
    // Create users table if not exists and insert test user
    const createResult = await query(`
      INSERT INTO users (
        email, phone_number, password_hash, first_name, last_name,
        date_of_birth, gender, country_code, gdp_pricing_tier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testUser.email, testUser.phoneNumber, testUser.passwordHash,
      testUser.firstName, testUser.lastName, testUser.dateOfBirth,
      testUser.gender, testUser.countryCode, testUser.gdpPricingTier
    ]);
    
    console.log('✅ Test user created successfully');
    
    // Query the user back
    const queryResult = await query('SELECT * FROM users WHERE email = ?', [testUser.email]);
    console.log('👤 User found:', queryResult.rows[0]);
    
    console.log('🎉 Database test completed successfully!');
    console.log('💡 The backend server can now use SQLite for development');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.log('🔧 Try installing SQLite dependencies: npm install sqlite3');
  }
}

testDatabase();