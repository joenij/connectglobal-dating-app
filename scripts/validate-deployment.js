#!/usr/bin/env node

/**
 * ConnectGlobal Enterprise Deployment Validation Script
 * ===================================================
 * 
 * This script validates that all enterprise features are properly configured
 * before deployment to production. Run this script before any deployment.
 * 
 * Usage:
 *   node scripts/validate-deployment.js
 *   npm run validate-deployment
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');

// Import enterprise services
const EnterpriseEnvironmentService = require('../backend/src/services/EnterpriseEnvironmentService');
const EnterpriseLogger = require('../backend/src/services/EnterpriseLoggerService');

class DeploymentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
    this.startTime = Date.now();
  }

  async validateDeployment() {
    console.log(`
🚀 ConnectGlobal Enterprise Deployment Validation
================================================
Environment: ${process.env.NODE_ENV || 'development'}
Timestamp: ${new Date().toISOString()}
    `);

    try {
      // 1. Validate environment configuration
      await this.validateEnvironmentConfiguration();
      
      // 2. Validate file structure
      await this.validateFileStructure();
      
      // 3. Validate dependencies
      await this.validateDependencies();
      
      // 4. Validate database schema
      await this.validateDatabaseSchema();
      
      // 5. Validate security configuration
      await this.validateSecurityConfiguration();
      
      // 6. Validate enterprise services
      await this.validateEnterpriseServices();
      
      // 7. Generate deployment report
      await this.generateDeploymentReport();
      
      return this.isDeploymentReady();
      
    } catch (error) {
      this.addError('CRITICAL', 'Deployment validation failed with error: ' + error.message);
      console.error('❌ Deployment validation failed:', error);
      return false;
    }
  }

  async validateEnvironmentConfiguration() {
    console.log('\n📋 1. Environment Configuration Validation');
    console.log('===========================================');
    
    try {
      const validation = await EnterpriseEnvironmentService.validateEnvironment();
      
      if (validation.valid) {
        this.addPassed('Environment configuration is valid');
        console.log('✅ Environment configuration validation passed');
      } else {
        validation.errors.forEach(error => {
          this.addError('ENVIRONMENT', error);
          console.log('❌', error);
        });
      }
      
      validation.warnings.forEach(warning => {
        this.addWarning('ENVIRONMENT', warning);
        console.log('⚠️ ', warning);
      });
      
      // Check production readiness
      const readiness = await EnterpriseEnvironmentService.checkProductionReadiness();
      console.log(`📊 Production Readiness Score: ${readiness.score}%`);
      
      if (readiness.score < 80) {
        this.addWarning('READINESS', `Production readiness score is low: ${readiness.score}%`);
      }
      
    } catch (error) {
      this.addError('ENVIRONMENT', 'Failed to validate environment: ' + error.message);
    }
  }

  async validateFileStructure() {
    console.log('\n📁 2. File Structure Validation');
    console.log('================================');
    
    const requiredFiles = [
      'backend/src/server.js',
      'backend/src/services/EnterpriseRedisService.js',
      'backend/src/services/EnterpriseSMSService.js',
      'backend/src/services/EnterpriseEmailService.js',
      'backend/src/services/EnterpriseLoggerService.js',
      'backend/src/services/EnterpriseAnalyticsService.js',
      'backend/src/services/EnterpriseEnvironmentService.js',
      'backend/package.json',
      'docker-compose.yml',
      '.env.example'
    ];
    
    const requiredDirectories = [
      'backend/src/routes',
      'backend/src/models',
      'backend/src/middleware',
      'backend/src/services',
      'backend/src/config',
      'docs',
      'logs'
    ];
    
    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, '..', file);
      if (fs.existsSync(filePath)) {
        this.addPassed(`Required file exists: ${file}`);
        console.log('✅', file);
      } else {
        this.addError('FILE_STRUCTURE', `Missing required file: ${file}`);
        console.log('❌', file);
      }
    }
    
    // Check required directories
    for (const dir of requiredDirectories) {
      const dirPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.addPassed(`Created required directory: ${dir}`);
        console.log('📁 Created:', dir);
      } else {
        this.addPassed(`Required directory exists: ${dir}`);
        console.log('✅', dir);
      }
    }
  }

  async validateDependencies() {
    console.log('\n📦 3. Dependencies Validation');
    console.log('==============================');
    
    try {
      const packagePath = path.join(__dirname, '..', 'backend', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const requiredDependencies = [
        'express',
        'redis',
        'nodemailer',
        'aws-sdk',
        'winston',
        'helmet',
        'bcryptjs',
        'jsonwebtoken',
        'express-rate-limit',
        'cors',
        'dotenv'
      ];
      
      for (const dep of requiredDependencies) {
        if (packageJson.dependencies[dep] || packageJson.devDependencies?.[dep]) {
          this.addPassed(`Dependency installed: ${dep}`);
          console.log('✅', dep);
        } else {
          this.addError('DEPENDENCIES', `Missing required dependency: ${dep}`);
          console.log('❌', dep);
        }
      }
      
      // Check for development vs production dependencies
      if (process.env.NODE_ENV === 'production') {
        const devDepsInProd = Object.keys(packageJson.devDependencies || {}).filter(dep => 
          requiredDependencies.includes(dep)
        );
        
        if (devDepsInProd.length > 0) {
          this.addWarning('DEPENDENCIES', 'Some required dependencies are in devDependencies: ' + devDepsInProd.join(', '));
        }
      }
      
    } catch (error) {
      this.addError('DEPENDENCIES', 'Failed to validate dependencies: ' + error.message);
    }
  }

  async validateDatabaseSchema() {
    console.log('\n💾 4. Database Schema Validation');
    console.log('=================================');
    
    try {
      // Check if database schema files exist
      const schemaFiles = [
        'backend/database/schema.sql',
        'supabase/schema.sql'
      ];
      
      let hasSchema = false;
      for (const schemaFile of schemaFiles) {
        const schemaPath = path.join(__dirname, '..', schemaFile);
        if (fs.existsSync(schemaPath)) {
          this.addPassed(`Database schema found: ${schemaFile}`);
          console.log('✅', schemaFile);
          hasSchema = true;
        }
      }
      
      if (!hasSchema) {
        this.addWarning('DATABASE', 'No database schema files found');
        console.log('⚠️  No database schema files found');
      }
      
      // Check database configuration
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        if (dbUrl.startsWith('postgresql://')) {
          this.addPassed('PostgreSQL database configured');
          console.log('✅ PostgreSQL database configured');
        } else if (dbUrl.includes('sqlite')) {
          this.addWarning('DATABASE', 'Using SQLite - consider PostgreSQL for production');
          console.log('⚠️  Using SQLite - consider PostgreSQL for production');
        }
      } else {
        this.addError('DATABASE', 'No DATABASE_URL configured');
        console.log('❌ No DATABASE_URL configured');
      }
      
    } catch (error) {
      this.addError('DATABASE', 'Failed to validate database: ' + error.message);
    }
  }

  async validateSecurityConfiguration() {
    console.log('\n🔒 5. Security Configuration Validation');
    console.log('========================================');
    
    // JWT Secret validation
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      this.addError('SECURITY', 'JWT_SECRET is not configured');
      console.log('❌ JWT_SECRET is not configured');
    } else if (jwtSecret.length < 32) {
      this.addError('SECURITY', 'JWT_SECRET is too short (minimum 32 characters)');
      console.log('❌ JWT_SECRET is too short');
    } else if (jwtSecret.length < 64) {
      this.addWarning('SECURITY', 'JWT_SECRET should be at least 64 characters');
      console.log('⚠️  JWT_SECRET should be at least 64 characters');
    } else {
      this.addPassed('JWT_SECRET is properly configured');
      console.log('✅ JWT_SECRET is properly configured');
    }
    
    // CORS configuration
    const corsOrigin = process.env.CORS_ORIGIN;
    if (!corsOrigin || corsOrigin === '*') {
      this.addWarning('SECURITY', 'CORS_ORIGIN should be configured for production');
      console.log('⚠️  CORS_ORIGIN should be configured for production');
    } else {
      this.addPassed('CORS_ORIGIN is configured');
      console.log('✅ CORS_ORIGIN is configured');
    }
    
    // Rate limiting
    const rateLimitMax = process.env.RATE_LIMIT_MAX_REQUESTS;
    if (rateLimitMax) {
      this.addPassed('Rate limiting is configured');
      console.log('✅ Rate limiting is configured');
    } else {
      this.addWarning('SECURITY', 'Rate limiting is not configured');
      console.log('⚠️  Rate limiting is not configured');
    }
    
    // SSL in production
    if (process.env.NODE_ENV === 'production') {
      const hasSsl = process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH;
      if (hasSsl) {
        this.addPassed('SSL certificates configured');
        console.log('✅ SSL certificates configured');
      } else {
        this.addWarning('SECURITY', 'SSL certificates not configured for production');
        console.log('⚠️  SSL certificates not configured for production');
      }
    }
  }

  async validateEnterpriseServices() {
    console.log('\n🏢 6. Enterprise Services Validation');
    console.log('====================================');
    
    try {
      // Validate Redis service
      const hasRedis = process.env.REDIS_URL || process.env.REDIS_HOST;
      if (hasRedis) {
        this.addPassed('Redis service is configured');
        console.log('✅ Redis service is configured');
      } else {
        this.addWarning('ENTERPRISE', 'Redis service is not configured - enterprise features limited');
        console.log('⚠️  Redis service is not configured');
      }
      
      // Validate Email service
      const hasEmail = process.env.AWS_SES_ACCESS_KEY_ID || process.env.SENDGRID_API_KEY || process.env.MAILGUN_API_KEY;
      if (hasEmail) {
        this.addPassed('Email service is configured');
        console.log('✅ Email service is configured');
      } else {
        this.addError('ENTERPRISE', 'No email service configured - email features will not work');
        console.log('❌ No email service configured');
      }
      
      // Validate SMS service
      const hasSMS = process.env.AWS_ACCESS_KEY_ID || process.env.TWILIO_ACCOUNT_SID;
      if (hasSMS) {
        this.addPassed('SMS service is configured');
        console.log('✅ SMS service is configured');
      } else {
        this.addError('ENTERPRISE', 'No SMS service configured - SMS verification will not work');
        console.log('❌ No SMS service configured');
      }
      
      // Validate Monitoring
      const hasMonitoring = process.env.SENTRY_DSN || process.env.AWS_CLOUDWATCH_LOG_GROUP;
      if (hasMonitoring) {
        this.addPassed('Monitoring service is configured');
        console.log('✅ Monitoring service is configured');
      } else {
        this.addWarning('ENTERPRISE', 'No monitoring service configured');
        console.log('⚠️  No monitoring service configured');
      }
      
    } catch (error) {
      this.addError('ENTERPRISE', 'Failed to validate enterprise services: ' + error.message);
    }
  }

  async generateDeploymentReport() {
    console.log('\n📊 7. Deployment Report Generation');
    console.log('===================================');
    
    const duration = Date.now() - this.startTime;
    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      duration: `${duration}ms`,
      summary: {
        passed: this.passed.length,
        warnings: this.warnings.length,
        errors: this.errors.length,
        deploymentReady: this.isDeploymentReady()
      },
      details: {
        passed: this.passed,
        warnings: this.warnings,
        errors: this.errors
      }
    };
    
    // Save report to file
    const reportsDir = path.join(__dirname, '..', 'deployment-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportFile = path.join(reportsDir, `deployment-validation-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    console.log(`📁 Report saved to: ${reportFile}`);
    
    return report;
  }

  isDeploymentReady() {
    return this.errors.length === 0;
  }

  addPassed(message) {
    this.passed.push({
      type: 'PASSED',
      message,
      timestamp: new Date().toISOString()
    });
  }

  addWarning(category, message) {
    this.warnings.push({
      type: 'WARNING',
      category,
      message,
      timestamp: new Date().toISOString()
    });
  }

  addError(category, message) {
    this.errors.push({
      type: 'ERROR',
      category,
      message,
      timestamp: new Date().toISOString()
    });
  }

  printSummary() {
    console.log(`
📊 DEPLOYMENT VALIDATION SUMMARY
=================================
✅ Passed: ${this.passed.length}
⚠️  Warnings: ${this.warnings.length}
❌ Errors: ${this.errors.length}

🚀 Deployment Ready: ${this.isDeploymentReady() ? 'YES' : 'NO'}

Duration: ${Date.now() - this.startTime}ms
    `);

    if (!this.isDeploymentReady()) {
      console.log('\n🚨 DEPLOYMENT BLOCKED - Fix the following errors:\n');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.category}] ${error.message}`);
      });
    } else {
      console.log('\n🎉 DEPLOYMENT READY - All critical validations passed!');
      
      if (this.warnings.length > 0) {
        console.log('\n💡 Consider addressing these warnings for optimal production performance:\n');
        this.warnings.forEach((warning, index) => {
          console.log(`${index + 1}. [${warning.category}] ${warning.message}`);
        });
      }
    }
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  const validator = new DeploymentValidator();
  
  validator.validateDeployment()
    .then((ready) => {
      validator.printSummary();
      process.exit(ready ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Deployment validation crashed:', error);
      process.exit(1);
    });
}

module.exports = DeploymentValidator;