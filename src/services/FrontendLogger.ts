import { Platform } from 'react-native';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  context?: any;
  userId?: string;
  sessionId?: string;
  platform: string;
  appVersion: string;
}

export interface LogConfig {
  minLevel: LogLevel;
  enableConsoleOutput: boolean;
  enableRemoteLogging: boolean;
  maxLogEntries: number;
  categories: string[];
}

class FrontendLoggerService {
  private static instance: FrontendLoggerService;
  private logs: LogEntry[] = [];
  private sessionId: string;
  private userId?: string;
  private config: LogConfig;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.config = {
      minLevel: __DEV__ ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsoleOutput: __DEV__,
      enableRemoteLogging: !__DEV__,
      maxLogEntries: 1000,
      categories: [
        'AdMob',
        'Revenue',
        'Matching',
        'Video',
        'Notifications',
        'API',
        'Auth',
        'Navigation',
        'Performance',
        'Error',
        'User'
      ]
    };

    this.info('Logger', 'FrontendLogger initialized', {
      platform: Platform.OS,
      session: this.sessionId,
      config: this.config
    });
  }

  public static getInstance(): FrontendLoggerService {
    if (!FrontendLoggerService.instance) {
      FrontendLoggerService.instance = new FrontendLoggerService();
    }
    return FrontendLoggerService.instance;
  }

  /**
   * Set current user ID for log context
   */
  public setUserId(userId: string): void {
    this.userId = userId;
    this.info('Logger', 'User context set', { userId });
  }

  /**
   * Update logger configuration
   */
  public updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.info('Logger', 'Configuration updated', { config: this.config });
  }

  /**
   * DEBUG level logging
   */
  public debug(category: string, message: string, context?: any): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  /**
   * INFO level logging
   */
  public info(category: string, message: string, context?: any): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  /**
   * WARN level logging
   */
  public warn(category: string, message: string, context?: any): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  /**
   * ERROR level logging
   */
  public error(category: string, message: string, error?: Error | any, context?: any): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    };
    this.log(LogLevel.ERROR, category, message, errorContext);
  }

  /**
   * CRITICAL level logging
   */
  public critical(category: string, message: string, error?: Error | any, context?: any): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    };
    this.log(LogLevel.CRITICAL, category, message, errorContext);
  }

  /**
   * AdMob specific logging methods
   */
  public admob = {
    initialized: () => this.info('AdMob', 'PRODUCTION AdMob ready - Revenue generation active!'),
    initFailed: (error: any) => this.error('AdMob', 'AdMob initialization failed', error),
    bannerLoaded: (adUnitId: string) => this.info('AdMob', 'PRODUCTION Banner ad loaded - Earning revenue!', { adUnitId }),
    bannerClicked: (adUnitId: string) => this.info('AdMob', 'Banner ad clicked - Revenue generated!', { adUnitId }),
    bannerFailed: (adUnitId: string, error: any) => this.error('AdMob', 'Banner ad failed to load', error, { adUnitId }),
    rewardedLoaded: (adUnitId: string) => this.info('AdMob', 'PRODUCTION Rewarded ad loaded - Ready to earn revenue!', { adUnitId }),
    rewardedOpened: (adUnitId: string) => this.info('AdMob', 'PRODUCTION Rewarded ad opened - User engaging!', { adUnitId }),
    rewardedEarned: (adUnitId: string, reward: any) => this.info('AdMob', 'PRODUCTION Reward earned - Revenue generated!', { adUnitId, reward }),
    rewardedFailed: (adUnitId: string, error: any) => this.error('AdMob', 'PRODUCTION Rewarded ad error', error, { adUnitId })
  };

  /**
   * Revenue Analytics specific logging
   */
  public revenue = {
    sessionStarted: (userId?: string) => this.info('Revenue', 'Revenue Analytics session started for PRODUCTION AdMob', { userId }),
    impressionTracked: (adType: string, adUnitId: string, revenue?: number) => 
      this.info('Revenue', `Ad Revenue Tracked from ${adType}`, { adType, adUnitId, revenue }),
    clickTracked: (adType: string, adUnitId: string) => this.info('Revenue', `Ad Click tracked: ${adType}`, { adType, adUnitId }),
    rewardCompleted: (adUnitId: string, reward: any, revenue?: number) => 
      this.info('Revenue', 'Rewarded Ad Completed', { adUnitId, reward, revenue }),
    adFailure: (adType: string, adUnitId: string, error: string) => 
      this.warn('Revenue', `Ad Failed: ${adType}`, { adType, adUnitId, error })
  };

  /**
   * Enhanced Matching specific logging
   */
  public matching = {
    discoveryRequest: (options: any) => this.info('Matching', 'Enhanced AI matching request', options),
    discoveryCompleted: (stats: any) => this.info('Matching', 'Enhanced AI matching completed', stats),
    discoveryFailed: (error: any, query?: any) => this.error('Matching', 'Enhanced matching discovery failed', error, { query }),
    actionPerformed: (action: string, targetUserId: string, isMatch?: boolean) => 
      this.info('Matching', `Match ${action} performed`, { action, targetUserId, isMatch }),
    actionFailed: (error: any, targetUserId?: string, action?: string) => 
      this.error('Matching', 'Match action failed', error, { targetUserId, action })
  };

  /**
   * Video service specific logging
   */
  public video = {
    uploadStarted: (fileName?: string, fileSize?: number) => this.info('Video', 'Video upload started with AI verification', { fileName, fileSize }),
    uploadCompleted: (status: string) => this.info('Video', 'Video processing completed', { status }),
    uploadFailed: (error: any, fileName?: string) => this.error('Video', 'Video upload failed', error, { fileName }),
    aiVerificationCompleted: (isApproved: boolean, deepfakeScore: number) => 
      this.info('Video', 'AI verification completed', { isApproved, deepfakeScore })
  };

  /**
   * Push Notifications specific logging
   */
  public notifications = {
    tokenRegistered: (platform: string, tokenPrefix: string) => 
      this.info('Notifications', 'Push token registered', { platform, tokenPrefix }),
    tokenRegistrationFailed: (error: any, platform?: string) => 
      this.error('Notifications', 'Push token registration failed', error, { platform }),
    preferencesUpdated: (preferences: any) => this.info('Notifications', 'Notification preferences updated', preferences),
    testSent: (type: string, result: any) => this.info('Notifications', 'Test notification sent', { type, result })
  };

  /**
   * API specific logging
   */
  public api = {
    requestStarted: (method: string, url: string, data?: any) => 
      this.debug('API', `${method} request started`, { method, url, hasData: !!data }),
    requestCompleted: (method: string, url: string, status: number, duration?: number) => 
      this.info('API', `${method} request completed`, { method, url, status, duration }),
    requestFailed: (method: string, url: string, error: any, status?: number) => 
      this.error('API', `${method} request failed`, error, { method, url, status })
  };

  /**
   * Core logging method
   */
  private log(level: LogLevel, category: string, message: string, context?: any): void {
    if (level < this.config.minLevel) return;

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      context,
      userId: this.userId,
      sessionId: this.sessionId,
      platform: Platform.OS,
      appVersion: '2.0.0'
    };

    // Add to internal log store
    this.addToLogStore(logEntry);

    // Console output (development)
    if (this.config.enableConsoleOutput) {
      this.outputToConsole(logEntry);
    }

    // Remote logging (production)
    if (this.config.enableRemoteLogging && level >= LogLevel.WARN) {
      this.sendToRemoteLogger(logEntry);
    }
  }

  /**
   * Add log entry to internal store
   */
  private addToLogStore(logEntry: LogEntry): void {
    this.logs.push(logEntry);
    
    // Maintain max log entries
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }
  }

  /**
   * Output to console with formatting
   */
  private outputToConsole(logEntry: LogEntry): void {
    const levelEmoji = this.getLevelEmoji(logEntry.level);
    const categoryEmoji = this.getCategoryEmoji(logEntry.category);
    const timestamp = logEntry.timestamp.toISOString().substr(11, 8);
    
    const logMessage = `${levelEmoji} [${timestamp}] ${categoryEmoji} ${logEntry.category}: ${logEntry.message}`;
    
    switch (logEntry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, logEntry.context);
        break;
      case LogLevel.INFO:
        console.info(logMessage, logEntry.context);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, logEntry.context);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(logMessage, logEntry.context);
        break;
    }
  }

  /**
   * Send to remote logging service
   */
  private sendToRemoteLogger(logEntry: LogEntry): void {
    // This would send to your backend logging service
    // For now, just store for later transmission
    try {
      // Implementation would depend on your backend logging endpoint
      // fetch('/api/v1/logs', { 
      //   method: 'POST', 
      //   body: JSON.stringify(logEntry) 
      // });
    } catch (error) {
      // Silently fail remote logging to avoid logging loops
    }
  }

  /**
   * Get logs for debugging or export
   */
  public getLogs(
    category?: string, 
    level?: LogLevel, 
    limit?: number
  ): LogEntry[] {
    let filteredLogs = this.logs;

    if (category) {
      filteredLogs = filteredLogs.filter(log => log.category === category);
    }

    if (level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level >= level);
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  /**
   * Export all logs as JSON
   */
  public exportLogs(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      userId: this.userId,
      platform: Platform.OS,
      exportTimestamp: new Date().toISOString(),
      logs: this.logs
    }, null, 2);
  }

  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = [];
    this.info('Logger', 'Log history cleared');
  }

  /**
   * Get log statistics
   */
  public getLogStats(): {
    total: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    sessionDuration: number;
  } {
    const byLevel: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    this.logs.forEach(log => {
      const levelName = LogLevel[log.level];
      byLevel[levelName] = (byLevel[levelName] || 0) + 1;
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
    });

    const sessionStart = this.logs[0]?.timestamp;
    const sessionDuration = sessionStart ? 
      Date.now() - sessionStart.getTime() : 0;

    return {
      total: this.logs.length,
      byLevel,
      byCategory,
      sessionDuration
    };
  }

  // Helper methods
  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🔍';
      case LogLevel.INFO: return '✅';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.ERROR: return '❌';
      case LogLevel.CRITICAL: return '🚨';
      default: return '📝';
    }
  }

  private getCategoryEmoji(category: string): string {
    const categoryEmojis: Record<string, string> = {
      'AdMob': '💰',
      'Revenue': '📊',
      'Matching': '🧠',
      'Video': '🎬',
      'Notifications': '🔔',
      'API': '🌐',
      'Auth': '🔐',
      'Navigation': '🗺️',
      'Performance': '⚡',
      'Error': '🚨',
      'User': '👤',
      'Logger': '📝'
    };
    return categoryEmojis[category] || '📋';
  }
}

export default FrontendLoggerService.getInstance();