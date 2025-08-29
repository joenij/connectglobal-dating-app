const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TEST_DATA_ENABLED = 'true';

const TestDataService = require('./backend/src/services/TestDataService');
const { initializeDatabase, closeDatabase } = require('./backend/src/config/database');

async function main() {
  console.log('🧪 Creating test database and sample data...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Database:', process.env.TEST_DB_NAME || 'connectglobal_test');
  
  try {
    // Initialize database connection
    console.log('📡 Connecting to test database...');
    const connected = await initializeDatabase();
    
    if (!connected) {
      console.error('❌ Failed to connect to test database');
      console.log('\n💡 Setup instructions:');
      console.log('1. Make sure PostgreSQL is running');
      console.log('2. Create test database: createdb connectglobal_test');
      console.log('3. Check your .env.test configuration');
      process.exit(1);
    }
    
    console.log('✅ Test database connected');
    
    // Initialize test environment
    console.log('🏗️  Setting up test environment...');
    const result = await TestDataService.initializeTestEnvironment();
    
    console.log('🎉 Test environment created successfully!');
    console.log(`👥 Created ${result.usersCreated} test users`);
    console.log('\n🔐 Test user credentials:');
    
    result.testCredentials.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Name: ${user.name}`);
      console.log('');
    });
    
    console.log('🚀 You can now test the matching system with these users!');
    console.log('🔄 To test matching, start the server with: NODE_ENV=test npm start');
    
  } catch (error) {
    console.error('❌ Failed to create test data:', error.message);
    process.exit(1);
  } finally {
    // Close database connection
    await closeDatabase();
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;