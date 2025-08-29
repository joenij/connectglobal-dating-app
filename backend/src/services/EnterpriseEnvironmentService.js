const EnterpriseLogger = require('./EnterpriseLoggerService');

class EnterpriseEnvironmentService {
  constructor() {
    this.requiredVariables = {};
    this.optionalVariables = {};
    this.validationRules = {};
    this.isValidated = false;
    this.defineEnvironmentSchema();
  }

  defineEnvironmentSchema() {
    // CRITICAL PRODUCTION VARIABLES
    this.requiredVariables = {
      // Core Application
      NODE_ENV: 'Environment mode (development/production)',
      JWT_SECRET: 'JWT signing secret (minimum 32 characters)',
      
      // Database (Production)
      DATABASE_URL: 'Production database connection string',
      
      // Enterprise SMTP Standard (MANDATORY - NO EXTERNAL SERVICES ALLOWED)
      ENTERPRISE_SMTP_HOST: 'Self-hosted enterprise SMTP server (MANDATORY)',
      ENTERPRISE_SMTP_USER: 'Enterprise SMTP authentication user (MANDATORY)', 
      ENTERPRISE_SMTP_PASS: 'Enterprise SMTP authentication password (MANDATORY)',
      ENTERPRISE_FROM_EMAIL: 'Enterprise from email address (MANDATORY)',
      DOMAIN_NAME: 'Your domain name for enterprise mail server (MANDATORY)'
    };

    // OPTIONAL BUT RECOMMENDED VARIABLES
    this.optionalVariables = {
      // Application
      PORT: 'Server port (default: 8000)',
      API_VERSION: 'API version (default: v1)',
      CORS_ORIGIN: 'CORS allowed origins',
      
      // Redis Configuration
      REDIS_URL: 'Redis connection string (for enterprise features)',
      REDIS_HOST: 'Redis host (if not using URL)',
      REDIS_PORT: 'Redis port (if not using URL)',
      REDIS_PASSWORD: 'Redis password (if required)',
      
      // AWS Services
      AWS_REGION: 'AWS region (default: us-east-1)',
      AWS_SNS_SMS_TYPE: 'SMS type for SNS (default: Transactional)',
      AWS_SES_REGION: 'SES region (default: us-east-1)',
      
      // DEPRECATED - External email services blocked by enterprise standard
      // SENDGRID_API_KEY: 'BLOCKED by ENTERPRISE_SMTP_STANDARD',
      // MAILGUN_API_KEY: 'BLOCKED by ENTERPRISE_SMTP_STANDARD',
      // MAILGUN_DOMAIN: 'BLOCKED by ENTERPRISE_SMTP_STANDARD',
      TWILIO_ACCOUNT_SID: 'Twilio account SID (alternative to AWS SNS)',
      TWILIO_AUTH_TOKEN: 'Twilio auth token (required with Twilio)',
      TWILIO_PHONE_NUMBER: 'Twilio phone number (required with Twilio)',
      
      // File Storage
      AWS_S3_BUCKET: 'S3 bucket for file storage',
      CLOUDFLARE_R2_ENDPOINT: 'Cloudflare R2 endpoint (alternative to S3)',
      
      // Security
      RATE_LIMIT_WINDOW_MS: 'Rate limiting window (default: 15 minutes)',
      RATE_LIMIT_MAX_REQUESTS: 'Max requests per window (default: 100)',
      
      // Logging
      LOG_LEVEL: 'Logging level (default: info)',
      LOG_FORMAT: 'Log format (json/simple, default: json in production)',
      SENTRY_DSN: 'Sentry DSN for error tracking',
      
      // Monitoring
      AWS_CLOUDWATCH_LOG_GROUP: 'CloudWatch log group for centralized logging'
    };

    // VALIDATION RULES
    this.validationRules = {
      NODE_ENV: (value) => ['development', 'production', 'staging'].includes(value),
      JWT_SECRET: (value) => value && value.length >= 32,
      PORT: (value) => !value || (parseInt(value) > 0 && parseInt(value) < 65536),
      DATABASE_URL: (value) => value && (value.startsWith('postgresql://') || value.startsWith('sqlite:')),
      FROM_EMAIL: (value) => value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      REDIS_PORT: (value) => !value || (parseInt(value) > 0 && parseInt(value) < 65536),
      AWS_REGION: (value) => !value || /^[a-z0-9-]+$/.test(value),
      RATE_LIMIT_WINDOW_MS: (value) => !value || parseInt(value) > 0,
      RATE_LIMIT_MAX_REQUESTS: (value) => !value || parseInt(value) > 0,
      LOG_LEVEL: (value) => !value || ['error', 'warn', 'info', 'debug', 'verbose', 'silly'].includes(value),
      LOG_FORMAT: (value) => !value || ['json', 'simple'].includes(value)
    };
  }

  // ENTERPRISE ENVIRONMENT VALIDATION
  async validateEnvironment() {
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      recommendations: [],
      serviceConfiguration: {},
      summary: {}
    };

    try {
      // Validate required variables
      const requiredCheck = this.validateRequiredVariables();
      results.errors.push(...requiredCheck.errors);
      if (requiredCheck.errors.length > 0) {
        results.valid = false;
      }

      // Validate variable formats
      const formatCheck = this.validateVariableFormats();
      results.errors.push(...formatCheck.errors);
      results.warnings.push(...formatCheck.warnings);

      // Check service configuration
      const serviceCheck = this.validateServiceConfiguration();
      results.serviceConfiguration = serviceCheck;
      results.recommendations.push(...serviceCheck.recommendations);
      results.warnings.push(...serviceCheck.warnings);

      // Security validation
      const securityCheck = this.validateSecurity();
      results.errors.push(...securityCheck.errors);
      results.warnings.push(...securityCheck.warnings);
      results.recommendations.push(...securityCheck.recommendations);

      // Generate summary
      results.summary = this.generateValidationSummary(results);

      this.isValidated = results.valid;

      if (results.valid) {
        EnterpriseLogger.info('✅ Environment validation successful', null, {
          services: Object.keys(results.serviceConfiguration).length,
          warnings: results.warnings.length,
          recommendations: results.recommendations.length
        });
      } else {
        EnterpriseLogger.error('❌ Environment validation failed', null, {
          errors: results.errors.length,
          warnings: results.warnings.length
        });
      }

      return results;

    } catch (error) {
      EnterpriseLogger.error('Environment validation error', error);
      return {
        valid: false,
        errors: ['Environment validation failed with error: ' + error.message],
        warnings: [],
        recommendations: [],
        serviceConfiguration: {},
        summary: { critical: true, error: error.message }
      };
    }
  }

  validateRequiredVariables() {
    const errors = [];
    const environment = process.env.NODE_ENV;

    // In production, all required variables must be set
    if (environment === 'production') {
      for (const [variable, description] of Object.entries(this.requiredVariables)) {
        if (!process.env[variable]) {
          errors.push(`❌ CRITICAL: Missing required environment variable: ${variable} - ${description}`);
        }
      }

      // ENTERPRISE SMTP STANDARD ENFORCEMENT
      const hasEnterpriseSmtp = process.env.ENTERPRISE_SMTP_HOST && 
                                process.env.ENTERPRISE_SMTP_USER && 
                                process.env.ENTERPRISE_SMTP_PASS;
      
      if (!hasEnterpriseSmtp) {
        errors.push('❌ CRITICAL: Enterprise SMTP not configured. ENTERPRISE_SMTP_HOST, ENTERPRISE_SMTP_USER, and ENTERPRISE_SMTP_PASS are mandatory.');
      }
      
      // Check for SMS service (AWS SNS or Twilio)
      const hasAWSSMS = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
      const hasTwilio = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
      
      if (!hasAWSSMS && !hasTwilio) {
        errors.push('❌ CRITICAL: No SMS service configured. Set up AWS SNS or Twilio.');
      }
    }

    return { errors };
  }

  validateVariableFormats() {
    const errors = [];
    const warnings = [];

    for (const [variable, validator] of Object.entries(this.validationRules)) {
      const value = process.env[variable];
      if (value && !validator(value)) {
        errors.push(`❌ Invalid format for ${variable}: ${value}`);
      }
    }

    // Check for weak JWT secrets
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
      warnings.push(`⚠️ JWT_SECRET should be at least 64 characters for maximum security (current: ${process.env.JWT_SECRET.length})`);
    }

    // Check for default values that should be changed
    const defaultValues = {
      JWT_SECRET: ['your-super-secure-jwt-secret', 'changeme', 'REPLACE_WITH_256_BIT_RANDOM_HEX_KEY_GENERATED_VIA_CRYPTO_RANDOMBYTES'],
      DATABASE_URL: ['your-database-url'],
      ENTERPRISE_FROM_EMAIL: ['noreply@connectglobal.app', 'noreply@yourdomain.com'],
      ENTERPRISE_SMTP_PASS: ['REPLACE_WITH_ULTRA_SECURE_PASSWORD_32_CHARS_MINIMUM'],
      ENCRYPTION_KEY: ['REPLACE_WITH_32_BYTE_HEX_KEY_FROM_CRYPTO_RANDOMBYTES'],
      MESSAGE_ENCRYPTION_KEY: ['REPLACE_WITH_32_BYTE_HEX_KEY_FROM_CRYPTO_RANDOMBYTES']
    };

    for (const [variable, defaults] of Object.entries(defaultValues)) {
      if (defaults.includes(process.env[variable])) {
        warnings.push(`⚠️ ${variable} appears to use a default value. Please change it for production.`);
      }
    }

    return { errors, warnings };
  }

  validateServiceConfiguration() {
    const config = {
      email: this.detectEmailService(),
      sms: this.detectSMSService(),
      redis: this.detectRedisService(),
      storage: this.detectStorageService(),
      monitoring: this.detectMonitoringServices()
    };

    const recommendations = [];
    const warnings = [];

    // Email service recommendations
    if (config.email.provider === 'none') {
      recommendations.push('📧 Set up an email service (AWS SES Free Tier recommended - 62,000 emails/month)');
    } else if (config.email.provider === 'simulation') {
      warnings.push('⚠️ Email service is in simulation mode - not suitable for production');
    }

    // SMS service recommendations
    if (config.sms.provider === 'none') {
      recommendations.push('📱 Set up an SMS service (AWS SNS Free Tier recommended - 100 SMS/month)');
    } else if (config.sms.provider === 'simulation') {
      warnings.push('⚠️ SMS service is in simulation mode - not suitable for production');
    }

    // Redis recommendations
    if (config.redis.provider === 'none') {
      recommendations.push('🔄 Set up Redis for enterprise features (Redis Labs Free Tier recommended - 30MB)');
    }

    // Storage recommendations
    if (config.storage.provider === 'local') {
      recommendations.push('📁 Consider cloud storage for production (AWS S3 Free Tier recommended - 5GB)');
    }

    // Monitoring recommendations
    if (Object.keys(config.monitoring).length === 0) {
      recommendations.push('📊 Set up monitoring (Sentry Free Tier recommended for error tracking)');
    }

    return { ...config, recommendations, warnings };
  }

  detectEmailService() {
    // ENTERPRISE SMTP STANDARD - ONLY SELF-HOSTED ALLOWED
    if (process.env.ENTERPRISE_SMTP_HOST && process.env.ENTERPRISE_SMTP_USER && process.env.ENTERPRISE_SMTP_PASS) {
      return { 
        provider: 'enterprise-smtp', 
        tier: 'enterprise-self-hosted', 
        limit: 'Unlimited (your server)',
        cost: '€3-10/month (Hetzner + domain)',
        standard: 'ENTERPRISE_SMTP_STANDARD_v1.0',
        security: 'MAXIMUM',
        features: 'TLS 1.3, DKIM, SPF, DMARC, Military-grade encryption',
        compliance: 'GDPR, Enterprise Standard'
      };
    }
    
    // BLOCKED EXTERNAL SERVICES (ENTERPRISE STANDARD VIOLATION)
    if (process.env.AWS_SES_ACCESS_KEY_ID || process.env.SENDGRID_API_KEY || process.env.MAILGUN_API_KEY) {
      return { 
        provider: 'BLOCKED_EXTERNAL_SERVICE', 
        violation: 'ENTERPRISE_SMTP_STANDARD_VIOLATION',
        error: 'External email services are BLOCKED by enterprise standard',
        action: 'REMOVE_EXTERNAL_CONFIG_AND_SETUP_ENTERPRISE_SMTP'
      };
    }
    
    return { 
      provider: 'NONE_CONFIGURED',
      status: 'ENTERPRISE_SMTP_REQUIRED',
      action: 'SETUP_ENTERPRISE_SMTP_SERVER',
      standard: 'ENTERPRISE_SMTP_STANDARD_v1.0_MANDATORY'
    };
  }

  detectSMSService() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      return { provider: 'aws-sns', tier: 'free', limit: '100 SMS/month' };
    }
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      return { provider: 'twilio', tier: 'trial', limit: '$15.50 credit' };
    }
    return { provider: process.env.NODE_ENV === 'development' ? 'simulation' : 'none' };
  }

  detectRedisService() {
    if (process.env.REDIS_URL) {
      const url = process.env.REDIS_URL;
      if (url.includes('redislabs.com')) {
        return { provider: 'redis-labs', tier: 'free', limit: '30MB RAM' };
      }
      if (url.includes('upstash.com')) {
        return { provider: 'upstash', tier: 'free', limit: '10k commands/day' };
      }
      return { provider: 'redis', tier: 'custom', limit: 'Unknown' };
    }
    if (process.env.REDIS_HOST) {
      return { provider: 'redis-local', tier: 'self-hosted', limit: 'Unlimited' };
    }
    return { provider: 'none' };
  }

  detectStorageService() {
    if (process.env.AWS_S3_BUCKET) {
      return { provider: 'aws-s3', tier: 'free', limit: '5GB, 20k GET, 2k PUT/month' };
    }
    if (process.env.CLOUDFLARE_R2_ENDPOINT) {
      return { provider: 'cloudflare-r2', tier: 'free', limit: '10GB storage, no egress fees' };
    }
    return { provider: 'local', tier: 'local', limit: 'Depends on disk space' };
  }

  detectMonitoringServices() {
    const services = {};
    
    if (process.env.SENTRY_DSN) {
      services.errorTracking = { provider: 'sentry', tier: 'free', limit: '5000 errors/month' };
    }
    
    if (process.env.AWS_CLOUDWATCH_LOG_GROUP) {
      services.logging = { provider: 'cloudwatch', tier: 'free', limit: '5GB ingestion/month' };
    }
    
    return services;
  }

  validateSecurity() {
    const errors = [];
    const warnings = [];
    const recommendations = [];

    // Check JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      errors.push('❌ SECURITY: JWT_SECRET is required');
    } else if (jwtSecret.length < 32) {
      errors.push('❌ SECURITY: JWT_SECRET must be at least 32 characters');
    } else if (jwtSecret.length < 64) {
      warnings.push('⚠️ SECURITY: JWT_SECRET should be at least 64 characters for maximum security');
    }

    // Check for HTTPS in production
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.SSL_CERT_PATH || !process.env.SSL_KEY_PATH) {
        recommendations.push('🔒 Configure SSL certificates for HTTPS in production');
      }
      
      if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
        warnings.push('⚠️ SECURITY: Configure specific CORS origins for production');
      }
    }

    // Rate limiting configuration
    if (!process.env.RATE_LIMIT_MAX_REQUESTS) {
      recommendations.push('🛡️ Configure rate limiting for production (RATE_LIMIT_MAX_REQUESTS)');
    }

    return { errors, warnings, recommendations };
  }

  generateValidationSummary(results) {
    const summary = {
      environment: process.env.NODE_ENV || 'development',
      valid: results.valid,
      readyForProduction: results.valid && results.errors.length === 0,
      criticalIssues: results.errors.length,
      warnings: results.warnings.length,
      recommendations: results.recommendations.length,
      servicesConfigured: Object.keys(results.serviceConfiguration).filter(key => 
        results.serviceConfiguration[key].provider && 
        results.serviceConfiguration[key].provider !== 'none' && 
        results.serviceConfiguration[key].provider !== 'simulation'
      ).length,
      enterpriseFeatures: {
        redis: results.serviceConfiguration.redis?.provider !== 'none',
        emailService: results.serviceConfiguration.email?.provider !== 'none',
        smsService: results.serviceConfiguration.sms?.provider !== 'none',
        monitoring: Object.keys(results.serviceConfiguration.monitoring || {}).length > 0,
        cloudStorage: results.serviceConfiguration.storage?.provider !== 'local'
      }
    };

    return summary;
  }

  // PRODUCTION READINESS CHECK
  async checkProductionReadiness() {
    const validation = await this.validateEnvironment();
    
    const readiness = {
      ready: validation.valid && validation.summary.criticalIssues === 0,
      score: this.calculateReadinessScore(validation),
      checklist: this.generateProductionChecklist(validation),
      blockers: validation.errors,
      improvements: validation.recommendations
    };

    return readiness;
  }

  calculateReadinessScore(validation) {
    let score = 100;
    
    // Deduct for critical errors
    score -= validation.errors.length * 20;
    
    // Deduct for warnings
    score -= validation.warnings.length * 5;
    
    // Add points for configured services
    const services = validation.serviceConfiguration;
    if (services.email?.provider !== 'none' && services.email?.provider !== 'simulation') score += 10;
    if (services.sms?.provider !== 'none' && services.sms?.provider !== 'simulation') score += 10;
    if (services.redis?.provider !== 'none') score += 5;
    if (services.storage?.provider !== 'local') score += 5;
    if (Object.keys(services.monitoring || {}).length > 0) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  generateProductionChecklist(validation) {
    const checklist = [
      {
        category: '🔒 Security',
        items: [
          { task: 'Strong JWT secret (64+ characters)', completed: process.env.JWT_SECRET?.length >= 64 },
          { task: 'CORS origins configured', completed: process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*' },
          { task: 'SSL certificates configured', completed: !!(process.env.SSL_CERT_PATH && process.env.SSL_KEY_PATH) },
          { task: 'Rate limiting configured', completed: !!process.env.RATE_LIMIT_MAX_REQUESTS }
        ]
      },
      {
        category: '📧 Communication Services',
        items: [
          { task: 'Email service configured', completed: validation.serviceConfiguration.email?.provider !== 'none' },
          { task: 'SMS service configured', completed: validation.serviceConfiguration.sms?.provider !== 'none' }
        ]
      },
      {
        category: '💾 Data & Storage',
        items: [
          { task: 'Production database configured', completed: process.env.DATABASE_URL?.startsWith('postgresql://') },
          { task: 'Redis cache configured', completed: validation.serviceConfiguration.redis?.provider !== 'none' },
          { task: 'Cloud storage configured', completed: validation.serviceConfiguration.storage?.provider !== 'local' }
        ]
      },
      {
        category: '📊 Monitoring & Logging',
        items: [
          { task: 'Error tracking configured', completed: !!validation.serviceConfiguration.monitoring?.errorTracking },
          { task: 'Log level set for production', completed: process.env.LOG_LEVEL === 'info' || process.env.LOG_LEVEL === 'warn' },
          { task: 'Centralized logging configured', completed: !!process.env.AWS_CLOUDWATCH_LOG_GROUP }
        ]
      }
    ];

    return checklist;
  }

  // HEALTH CHECK
  getEnvironmentHealth() {
    return {
      validated: this.isValidated,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      configuredServices: Object.keys(process.env).filter(key => 
        key.startsWith('AWS_') || 
        key.startsWith('REDIS_') || 
        key.startsWith('SENDGRID_') ||
        key.startsWith('TWILIO_') ||
        key.startsWith('MAILGUN_')
      ).length
    };
  }
}

module.exports = new EnterpriseEnvironmentService();