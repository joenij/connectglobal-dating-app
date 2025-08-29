// Use PostgreSQL for all environments
const { query, transaction } = require('../config/database');
const EnterpriseLogger = require('./EnterpriseLoggerService');
const bcrypt = require('bcrypt');

class TestDataService {
  constructor() {
    this.testUsers = [];
    this.isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.TEST_DATA_ENABLED === 'true';
  }

  // Generate realistic test user data
  generateTestUser(index) {
    const firstNames = [
      // Deutsche Namen für lokales Testing
      'Anna', 'Max', 'Emma', 'Paul', 'Lena', 'Felix', 'Sarah', 'Leon',
      'Laura', 'Finn', 'Sophie', 'Tim', 'Marie', 'Jonas', 'Lisa', 'Ben',
      'Julia', 'Noah', 'Mia', 'Luca', 'Hannah', 'David', 'Leonie', 'Jan'
    ];
    
    const lastNames = [
      'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner',
      'Becker', 'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter',
      'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann'
    ];
    
    const cities = [
      // Hannover und Umgebung - realistisch für lokales Testing
      { name: 'Hannover', country: 'DE', lat: 52.3759, lng: 9.7320 },
      { name: 'Braunschweig', country: 'DE', lat: 52.2689, lng: 10.5268 },
      { name: 'Göttingen', country: 'DE', lat: 51.5414, lng: 9.9158 },
      { name: 'Wolfsburg', country: 'DE', lat: 52.4227, lng: 10.7865 },
      { name: 'Hildesheim', country: 'DE', lat: 52.1561, lng: 9.9511 },
      { name: 'Celle', country: 'DE', lat: 52.6240, lng: 10.0805 },
      { name: 'Hamburg', country: 'DE', lat: 53.5511, lng: 9.9937 }, // ~150km
      { name: 'Bremen', country: 'DE', lat: 53.0793, lng: 8.8017 }  // ~120km
    ];
    
    const interests = [
      ['Travel', 'Photography', 'Hiking', 'Reading'],
      ['Music', 'Dancing', 'Cooking', 'Yoga'],
      ['Technology', 'Gaming', 'Programming', 'Movies'],
      ['Sports', 'Fitness', 'Running', 'Swimming'],
      ['Art', 'Design', 'Writing', 'Theater'],
      ['Food', 'Wine', 'Coffee', 'Restaurants']
    ];
    
    const bios = [
      'Hannover-Fan, der gerne neue Orte entdeckt und verschiedene Küchen ausprobiert. Suche jemanden zum Teilen von Abenteuern!',
      'Technik-Enthusiast bei Tag, Musiker bei Nacht. Immer bereit für tiefe Gespräche und gute Lacher.',
      'Fitness-Liebhaber, der gerne draußen aktiv ist. Suche jemanden mit positiver Einstellung und Lebensfreude.',
      'Kreative Seele mit Leidenschaft für Kunst und Design. Liebe spontane Roadtrips und gemütliche Filmabende.',
      'Foodie, der gerne kocht und neue Restaurants in Hannover entdeckt. Suche meinen Partner in Crime!',
      'Abenteuerlustig mit Vorliebe fürs Wandern und Fotografieren. Wollen wir zusammen die Welt erkunden?',
      'Lebe in Hannover und liebe es! Bin oft im Maschsee oder in der Altstadt unterwegs. Sport und Kultur sind mein Ding.',
      'Student/in in Hannover, entdecke gerne die Stadt und ihre Geheimnisse. Wer zeigt mir seine Lieblingsorte?'
    ];

    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[(index + 3) % lastNames.length];
    const city = cities[index % cities.length];
    const userInterests = interests[index % interests.length];
    const bio = bios[index % bios.length];
    
    return {
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@testuser.com`,
      password: 'TestPassword123!',
      firstName,
      lastName,
      age: 20 + (index % 15), // Ages 20-34
      bio,
      city: city.name,
      country: city.country,
      latitude: city.lat + (Math.random() - 0.5) * 0.1, // Small random offset
      longitude: city.lng + (Math.random() - 0.5) * 0.1,
      interests: userInterests,
      verified: index % 3 === 0, // Every 3rd user is verified
      profileComplete: index % 4 !== 0, // 75% have complete profiles
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
      isTestUser: true
    };
  }

  // Create test database tables if they don't exist
  async createTestTables() {
    if (!this.isTestEnvironment) {
      throw new Error('Test data can only be created in test environment');
    }

    try {
      // Users table
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          age INTEGER,
          bio TEXT,
          city VARCHAR(100),
          country VARCHAR(2),
          latitude DECIMAL(10,8),
          longitude DECIMAL(11,8),
          interests TEXT[], 
          verified BOOLEAN DEFAULT false,
          profile_complete BOOLEAN DEFAULT false,
          is_test_user BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // User matches table
      await query(`
        CREATE TABLE IF NOT EXISTS user_matches (
          id SERIAL PRIMARY KEY,
          user1_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          user2_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          action VARCHAR(20) NOT NULL, -- 'like', 'pass', 'super_like'
          is_match BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user1_id, user2_id)
        )
      `);

      EnterpriseLogger.info('Test tables created successfully', null, {
        environment: process.env.NODE_ENV,
        tablesCreated: ['users', 'user_matches']
      });

      return true;
    } catch (error) {
      EnterpriseLogger.error('Failed to create test tables', error);
      return false;
    }
  }

  // Populate database with test users
  async populateTestUsers(count = 10) {
    if (!this.isTestEnvironment) {
      throw new Error('Test data can only be created in test environment');
    }

    try {
      // First, clear existing test users
      await query('DELETE FROM users WHERE is_test_user = true');
      
      EnterpriseLogger.info('Creating test users', null, { count });

      for (let i = 0; i < count; i++) {
        const testUser = this.generateTestUser(i);
        const hashedPassword = await bcrypt.hash(testUser.password, 10);
        
        const result = await query(`
          INSERT INTO users (
            email, password_hash, first_name, last_name, age, bio, city, country,
            latitude, longitude, interests, verified, profile_complete, is_test_user,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id
        `, [
          testUser.email, hashedPassword, testUser.firstName, testUser.lastName,
          testUser.age, testUser.bio, testUser.city, testUser.country,
          testUser.latitude, testUser.longitude, testUser.interests,
          testUser.verified, testUser.profileComplete, testUser.isTestUser,
          testUser.createdAt
        ]);
        
        testUser.id = result.rows[0].id;
        this.testUsers.push(testUser);
      }

      // Generate some random matches for testing
      await this.generateTestMatches();

      EnterpriseLogger.info('Test users created successfully', null, {
        usersCreated: this.testUsers.length,
        testDatabase: true
      });

      return this.testUsers;
    } catch (error) {
      EnterpriseLogger.error('Failed to populate test users', error);
      throw error;
    }
  }

  // Generate some test matches between users
  async generateTestMatches() {
    const matchCount = Math.min(this.testUsers.length * 2, 50); // Generate some matches
    
    for (let i = 0; i < matchCount; i++) {
      const user1 = this.testUsers[Math.floor(Math.random() * this.testUsers.length)];
      const user2 = this.testUsers[Math.floor(Math.random() * this.testUsers.length)];
      
      if (user1.id !== user2.id) {
        const actions = ['like', 'pass', 'super_like'];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const isMatch = action === 'like' && Math.random() > 0.7; // 30% chance of match on like
        
        try {
          await query(`
            INSERT INTO user_matches (user1_id, user2_id, action, is_match)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user1_id, user2_id) DO NOTHING
          `, [user1.id, user2.id, action, isMatch]);
        } catch (error) {
          // Ignore duplicates
        }
      }
    }
  }

  // Get test user credentials for authentication testing
  getTestUserCredentials() {
    if (!this.isTestEnvironment) {
      return null;
    }
    
    return this.testUsers.slice(0, 3).map(user => ({
      email: user.email,
      password: 'TestPassword123!',
      name: `${user.firstName} ${user.lastName}`
    }));
  }

  // Clean up test data
  async cleanupTestData() {
    if (!this.isTestEnvironment) {
      throw new Error('Test data cleanup can only be run in test environment');
    }

    try {
      await query('DELETE FROM user_matches WHERE user1_id IN (SELECT id FROM users WHERE is_test_user = true) OR user2_id IN (SELECT id FROM users WHERE is_test_user = true)');
      await query('DELETE FROM users WHERE is_test_user = true');
      
      this.testUsers = [];
      
      EnterpriseLogger.info('Test data cleaned up successfully', null, {
        environment: process.env.NODE_ENV
      });
      
      return true;
    } catch (error) {
      EnterpriseLogger.error('Failed to cleanup test data', error);
      return false;
    }
  }

  // Initialize full test environment
  async initializeTestEnvironment() {
    if (!this.isTestEnvironment) {
      throw new Error('Test environment initialization can only be run in test environment');
    }

    try {
      EnterpriseLogger.info('Initializing test environment', null, {
        environment: process.env.NODE_ENV,
        testDataEnabled: process.env.TEST_DATA_ENABLED
      });

      // Create tables
      await this.createTestTables();
      
      // Populate test users
      const userCount = parseInt(process.env.MATCHING_TEST_USERS) || 10;
      await this.populateTestUsers(userCount);
      
      EnterpriseLogger.info('Test environment initialized successfully', null, {
        testUsersCreated: this.testUsers.length,
        matchingEnabled: true,
        environment: process.env.NODE_ENV
      });

      return {
        success: true,
        usersCreated: this.testUsers.length,
        testCredentials: this.getTestUserCredentials()
      };
    } catch (error) {
      EnterpriseLogger.error('Test environment initialization failed', error);
      throw error;
    }
  }
}

module.exports = new TestDataService();