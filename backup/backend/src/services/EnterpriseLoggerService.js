const winston = require('winston');
const path = require('path');

class EnterpriseLoggerService {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'info');
    this.logFormat = process.env.LOG_FORMAT || (this.isProduction ? 'json' : 'simple');
    
    this.initialize();
  }

  initialize() {
    // Ensure logs directory exists
    const fs = require('fs');
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Define log formats
    const formats = {
      json: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
      ),
      simple: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          let log = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
          }
          if (stack) {
            log += `\n${stack}`;
          }
          return log;
        })
      )
    };

    // Create winston logger instance
    this.logger = winston.createLogger({
      level: this.logLevel,
      format: formats[this.logFormat] || formats.simple,
      defaultMeta: { 
        service: 'connectglobal-api',
        version: process.env.API_VERSION || 'v1',
        environment: process.env.NODE_ENV || 'development'
      },
      transports: [
        // Console transport (always enabled in development)
        new winston.transports.Console({
          silent: this.isProduction && process.env.DISABLE_CONSOLE_LOGS === 'true'
        }),

        // File transport for all logs
        new winston.transports.File({
          filename: path.join(logsDir, 'app.log'),
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        }),

        // Error-only file transport
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 3,
          tailable: true
        })
      ],

      // Handle exceptions and rejections
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'exceptions.log'),
          maxsize: 10 * 1024 * 1024,
          maxFiles: 2
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'rejections.log'),
          maxsize: 10 * 1024 * 1024,
          maxFiles: 2
        })
      ],
      exitOnError: false
    });

    // Add additional transports for production
    if (this.isProduction) {
      // Add any external logging services here
      // Example: Sentry, LogRocket, CloudWatch, etc.
      this.addProductionTransports();
    }

    console.log(`✅ Enterprise Logger initialized - Level: ${this.logLevel}, Format: ${this.logFormat}`);
  }

  addProductionTransports() {
    // Sentry integration (if configured)
    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = require('@sentry/node');
        // Sentry would be initialized elsewhere, this just adds winston integration
        this.logger.info('🔗 Sentry integration available for error tracking');
      } catch (error) {
        this.logger.warn('⚠️ Sentry not available - install @sentry/node for error tracking');
      }
    }

    // AWS CloudWatch integration (if configured)
    if (process.env.AWS_CLOUDWATCH_LOG_GROUP) {
      try {
        const CloudWatchTransport = require('winston-cloudwatch');
        this.logger.add(new CloudWatchTransport({
          logGroupName: process.env.AWS_CLOUDWATCH_LOG_GROUP,
          logStreamName: `${process.env.NODE_ENV}-${new Date().toISOString().split('T')[0]}`,
          awsOptions: {
            region: process.env.AWS_REGION || 'us-east-1'
          }
        }));
        this.logger.info('☁️ AWS CloudWatch logging enabled');
      } catch (error) {
        this.logger.warn('⚠️ AWS CloudWatch not available - install winston-cloudwatch');
      }
    }
  }

  // ENTERPRISE LOGGING METHODS

  // Security Events
  security(message, meta = {}) {
    this.logger.error(`🛡️ SECURITY: ${message}`, {
      type: 'security',
      severity: 'high',
      ...meta
    });
  }

  // Authentication Events
  auth(message, userId = null, meta = {}) {
    this.logger.info(`🔐 AUTH: ${message}`, {
      type: 'authentication',
      userId,
      ...meta
    });
  }

  // API Request Logging
  request(req, res, duration) {
    const { method, originalUrl, ip, user } = req;
    const { statusCode } = res;
    
    this.logger.info(`📡 ${method} ${originalUrl}`, {
      type: 'http_request',
      method,
      url: originalUrl,
      statusCode,
      ip,
      userId: user?.id,
      userAgent: req.get('User-Agent'),
      duration: `${duration}ms`,
      responseSize: res.get('Content-Length'),
      referrer: req.get('Referer')
    });
  }

  // Database Operations
  database(operation, table, meta = {}) {
    this.logger.debug(`💾 DB ${operation.toUpperCase()}: ${table}`, {
      type: 'database',
      operation,
      table,
      ...meta
    });
  }

  // External API Calls
  externalAPI(service, endpoint, status, duration, meta = {}) {
    this.logger.info(`🌐 ${service.toUpperCase()}: ${endpoint}`, {
      type: 'external_api',
      service,
      endpoint,
      status,
      duration: `${duration}ms`,
      ...meta
    });
  }

  // Business Logic Events
  business(event, meta = {}) {
    this.logger.info(`💼 BUSINESS: ${event}`, {
      type: 'business',
      event,
      ...meta
    });
  }

  // Performance Monitoring
  performance(operation, duration, meta = {}) {
    const level = duration > 1000 ? 'warn' : 'info';
    this.logger.log(level, `⚡ PERFORMANCE: ${operation} took ${duration}ms`, {
      type: 'performance',
      operation,
      duration,
      ...meta
    });
  }

  // Error Handling with Context
  error(message, error = null, context = {}) {
    const errorData = {
      type: 'application_error',
      message,
      ...context
    };

    if (error) {
      errorData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      };
    }

    this.logger.error(`❌ ${message}`, errorData);
  }

  // Standard Winston Methods (for backward compatibility)
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  verbose(message, meta = {}) {
    this.logger.verbose(message, meta);
  }

  silly(message, meta = {}) {
    this.logger.silly(message, meta);
  }

  // ENTERPRISE ANALYTICS
  getLogStats() {
    return {
      level: this.logLevel,
      format: this.logFormat,
      environment: process.env.NODE_ENV,
      transports: this.logger.transports.length,
      logDirectory: path.join(process.cwd(), 'logs'),
      features: {
        fileRotation: true,
        errorTracking: !!process.env.SENTRY_DSN,
        cloudwatchIntegration: !!process.env.AWS_CLOUDWATCH_LOG_GROUP,
        structuredLogging: this.logFormat === 'json'
      }
    };
  }

  // MIGRATION HELPERS - Replace console.log gradually
  replaceConsoleLog() {
    if (this.isDevelopment) {
      // In development, keep console.log behavior but add winston
      const originalLog = console.log;
      console.log = (...args) => {
        originalLog(...args);
        this.info(args.join(' '));
      };

      const originalError = console.error;
      console.error = (...args) => {
        originalError(...args);
        this.error(args.join(' '));
      };

      const originalWarn = console.warn;
      console.warn = (...args) => {
        originalWarn(...args);
        this.warn(args.join(' '));
      };
    } else {
      // In production, replace console methods entirely
      console.log = (...args) => this.info(args.join(' '));
      console.error = (...args) => this.error(args.join(' '));
      console.warn = (...args) => this.warn(args.join(' '));
      console.info = (...args) => this.info(args.join(' '));
      console.debug = (...args) => this.debug(args.join(' '));
    }

    this.info('🔄 Console methods replaced with Enterprise Logger');
  }

  // Health Check
  healthCheck() {
    try {
      this.info('🏥 Enterprise Logger health check');
      return {
        status: 'healthy',
        level: this.logLevel,
        format: this.logFormat,
        transports: this.logger.transports.length,
        enterprise: true
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        enterprise: false
      };
    }
  }
}

module.exports = new EnterpriseLoggerService();