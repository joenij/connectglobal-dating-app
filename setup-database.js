const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up ConnectGlobal Database...\n');

// Check if PostgreSQL is available
function checkPostgreSQL() {
  return new Promise((resolve, reject) => {
    exec('psql --version', (error, stdout, stderr) => {
      if (error) {
        console.error('❌ PostgreSQL not found. Please install PostgreSQL first.');
        console.log('Download from: https://www.postgresql.org/download/');
        reject(error);
      } else {
        console.log('✅ PostgreSQL found:', stdout.trim());
        resolve(true);
      }
    });
  });
}

// Create database
function createDatabase() {
  return new Promise((resolve, reject) => {
    const dbName = 'connectglobal_dev';
    exec(`createdb ${dbName}`, (error, stdout, stderr) => {
      if (error) {
        if (error.message.includes('already exists')) {
          console.log('✅ Database already exists: connectglobal_dev');
          resolve(true);
        } else {
          console.error('❌ Failed to create database:', error.message);
          console.log('Try running manually: createdb connectglobal_dev');
          reject(error);
        }
      } else {
        console.log('✅ Database created: connectglobal_dev');
        resolve(true);
      }
    });
  });
}

// Run schema
function runSchema() {
  return new Promise((resolve, reject) => {
    const schemaPath = path.join(__dirname, 'backend', 'database', 'schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found:', schemaPath);
      reject(new Error('Schema file not found'));
      return;
    }

    const command = `psql -d connectglobal_dev -f "${schemaPath}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Failed to run schema:', error.message);
        console.log('Try running manually:', command);
        reject(error);
      } else {
        console.log('✅ Database schema created successfully');
        if (stdout) console.log(stdout);
        resolve(true);
      }
    });
  });
}

// Main setup function
async function setupDatabase() {
  try {
    await checkPostgreSQL();
    await createDatabase();
    await runSchema();
    
    console.log('\n🎉 Database setup complete!');
    console.log('You can now start the backend server with: npm run backend:dev');
    
  } catch (error) {
    console.log('\n❌ Database setup failed. Manual steps:');
    console.log('1. Install PostgreSQL: https://www.postgresql.org/download/');
    console.log('2. Create database: createdb connectglobal_dev');
    console.log('3. Run schema: psql -d connectglobal_dev -f backend/database/schema.sql');
    console.log('4. Update .env file with your database credentials');
  }
}

setupDatabase();