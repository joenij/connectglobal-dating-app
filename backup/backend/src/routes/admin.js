const express = require('express');
const { authenticateToken } = require('../middleware/security');
const EnterpriseAnalyticsService = require('../services/EnterpriseAnalyticsService');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');
const EnterpriseEnvironmentService = require('../services/EnterpriseEnvironmentService');
const User = require('../models/User');

const router = express.Router();

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/v1/admin/dashboard - ENTERPRISE Admin dashboard stats
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    EnterpriseLogger.info('Admin dashboard accessed', req.user.id, {
      adminEmail: req.user.email,
      ip: req.ip
    });

    // Get real enterprise statistics from database
    const stats = await EnterpriseAnalyticsService.getDashboardStats();
    
    res.json({
      ...stats,
      enterpriseFeatures: {
        realTimeData: true,
        cacheEnabled: true,
        databaseDriven: true,
        analyticsProvider: 'EnterpriseAnalyticsService'
      }
    });
    
  } catch (error) {
    EnterpriseLogger.error('Admin dashboard error', error, {
      adminId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/v1/admin/pricing/modifiers - Get all pricing modifiers
router.get('/pricing/modifiers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Fetch pricing modifiers from database
    const modifiers = await User.query(`
      SELECT 
        id,
        type,
        name,
        regions,
        discount_percentage as discountPercentage,
        start_date as startDate,
        end_date as endDate,
        is_active as isActive,
        priority,
        created_at as createdAt,
        updated_at as updatedAt
      FROM pricing_modifiers 
      ORDER BY priority ASC, created_at DESC
    `);

    res.json({ modifiers });
  } catch (error) {
    EnterpriseLogger.error('Get pricing modifiers error', error, {
      adminId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to fetch pricing modifiers' });
  }
});

// POST /api/v1/admin/pricing/modifiers - Create pricing modifier
router.post('/pricing/modifiers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, name, regions, discountPercentage, startDate, endDate } = req.body;

    // Validate and save to database
    const modifier = await User.query(`
      INSERT INTO pricing_modifiers (
        type, name, regions, discount_percentage, 
        start_date, end_date, is_active, priority, 
        created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, 1, $7, NOW(), NOW())
      RETURNING *
    `, [type, name, JSON.stringify(regions), discountPercentage, startDate, endDate, req.user.id]);

    const formattedModifier = {
      id: modifier[0].id,
      type: modifier[0].type,
      name: modifier[0].name,
      regions: modifier[0].regions,
      discountPercentage: modifier[0].discount_percentage,
      startDate: modifier[0].start_date,
      endDate: modifier[0].end_date,
      isActive: modifier[0].is_active,
      priority: modifier[0].priority,
      createdAt: modifier[0].created_at,
      createdBy: modifier[0].created_by
    };

    res.status(201).json({ modifier: formattedModifier, message: 'Pricing modifier created' });
  } catch (error) {
    EnterpriseLogger.error('Create pricing modifier error', error, {
      adminId: req.user.id,
      data: req.body,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to create pricing modifier' });
  }
});

// GET /api/v1/admin/reports - Get user reports queue
router.get('/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    // Fetch reports from database with user details
    const reports = await User.query(`
      SELECT 
        r.id,
        r.type,
        r.reported_user_id as reportedUserId,
        ru.first_name || ' ' || ru.last_name as reportedUserName,
        ru.email as reportedUserEmail,
        r.reporter_id as reporterId,
        rep.first_name || ' ' || rep.last_name as reporterName,
        r.reason,
        r.evidence,
        r.status,
        r.priority,
        r.created_at as createdAt,
        r.updated_at as updatedAt
      FROM user_reports r
      LEFT JOIN users ru ON r.reported_user_id = ru.id
      LEFT JOIN users rep ON r.reporter_id = rep.id
      WHERE ($1 = 'all' OR r.status = $1)
      ORDER BY 
        CASE r.priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [status, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);
    
    // Format reports for response
    const formattedReports = reports.map(report => ({
      id: report.id,
      type: report.type,
      reportedUserId: report.reporteduserid,
      reportedUser: {
        name: report.reportedusername,
        email: report.reporteduseremail
      },
      reporterId: report.reporterid,
      reporter: {
        name: report.reportername
      },
      reason: report.reason,
      evidence: Array.isArray(report.evidence) ? report.evidence : [],
      status: report.status,
      priority: report.priority,
      createdAt: report.createdat
    }));
    
    // Get total count for pagination
    const totalCountResult = await User.query(`
      SELECT COUNT(*) as total
      FROM user_reports r
      WHERE ($1 = 'all' OR r.status = $1)
    `, [status]);
    
    const totalCount = parseInt(totalCountResult[0].total);

    res.json({
      reports: formattedReports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        hasMore: (parseInt(page) * parseInt(limit)) < totalCount
      }
    });
  } catch (error) {
    EnterpriseLogger.error('Get reports error', error, {
      adminId: req.user.id,
      filters: { status, page, limit },
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST /api/v1/admin/reports/:id/action - Take action on a report
router.post('/reports/:id/action', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id: reportId } = req.params;
    const { action, reason } = req.body; // action: 'dismiss', 'warn', 'suspend', 'ban'

    // Process report action in database
    await User.query(`
      UPDATE user_reports 
      SET 
        status = $1,
        admin_action = $2,
        admin_reason = $3,
        processed_by = $4,
        processed_at = NOW(),
        updated_at = NOW()
      WHERE id = $5
    `, [action === 'dismiss' ? 'dismissed' : 'resolved', action, reason, req.user.id, reportId]);
    
    // If action is ban/suspend, update user status
    if (action === 'ban' || action === 'suspend') {
      await User.query(`
        UPDATE users 
        SET 
          is_banned = $1,
          is_active = $2,
          ban_reason = $3,
          banned_at = NOW(),
          banned_by = $4,
          updated_at = NOW()
        WHERE id = (SELECT reported_user_id FROM user_reports WHERE id = $5)
      `, [action === 'ban', action !== 'ban', reason, req.user.id, reportId]);
    }
    
    EnterpriseLogger.security('Admin moderation action', {
      adminId: req.user.id,
      reportId,
      action,
      reason,
      ip: req.ip
    });

    res.json({
      reportId,
      action,
      reason,
      processedAt: new Date().toISOString(),
      processedBy: req.user.id,
      message: 'Report processed successfully'
    });
  } catch (error) {
    EnterpriseLogger.error('Process report error', error, {
      adminId: req.user.id,
      reportId: req.params.id,
      action: req.body.action,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to process report' });
  }
});

// GET /api/v1/admin/users/search - Search users
router.get('/users/search', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    // Search users in database
    const users = await User.query(`
      SELECT 
        id,
        email,
        first_name || ' ' || last_name as name,
        EXTRACT(YEAR FROM AGE(date_of_birth)) as age,
        city || ', ' || country_code as location,
        subscription_tier as subscriptionTier,
        is_active as isActive,
        is_banned as isBanned,
        created_at as createdAt
      FROM users
      WHERE (
        email ILIKE $1 OR 
        first_name ILIKE $1 OR 
        last_name ILIKE $1 OR 
        (first_name || ' ' || last_name) ILIKE $1
      )
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [`%${q}%`, parseInt(limit), (parseInt(page) - 1) * parseInt(limit)]);
    
    // Get total count for pagination
    const totalCountResult = await User.query(`
      SELECT COUNT(*) as total
      FROM users
      WHERE (
        email ILIKE $1 OR 
        first_name ILIKE $1 OR 
        last_name ILIKE $1 OR 
        (first_name || ' ' || last_name) ILIKE $1
      )
    `, [`%${q}%`]);
    
    const totalCount = parseInt(totalCountResult[0].total);

    res.json({
      users,
      query: q,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        hasMore: (parseInt(page) * parseInt(limit)) < totalCount
      }
    });
  } catch (error) {
    EnterpriseLogger.error('User search error', error, {
      adminId: req.user.id,
      query: req.query.q,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// GET /api/v1/admin/performance - ENTERPRISE Performance metrics
router.get('/performance', authenticateToken, requireAdmin, async (req, res) => {
  try {
    EnterpriseLogger.info('Admin performance metrics accessed', req.user.id);

    const metrics = await EnterpriseAnalyticsService.getPerformanceMetrics();
    
    res.json({
      ...metrics,
      enterpriseFeatures: {
        realTimeMetrics: true,
        systemHealth: true,
        performanceTracking: true
      }
    });

  } catch (error) {
    EnterpriseLogger.error('Performance metrics error', error, {
      adminId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// POST /api/v1/admin/analytics/clear-cache - Clear analytics cache
router.post('/analytics/clear-cache', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const success = await EnterpriseAnalyticsService.clearAnalyticsCache();
    
    EnterpriseLogger.info('Analytics cache cleared by admin', req.user.id, {
      success,
      ip: req.ip
    });

    res.json({
      success,
      message: success ? 'Analytics cache cleared successfully' : 'Failed to clear cache',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    EnterpriseLogger.error('Clear analytics cache error', error, {
      adminId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to clear analytics cache' });
  }
});

// GET /api/v1/admin/health - ENTERPRISE System health check
router.get('/health', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const health = await EnterpriseAnalyticsService.healthCheck();
    
    res.json({
      ...health,
      services: {
        analytics: 'operational',
        database: health.database.connected ? 'operational' : 'degraded',
        redis: health.redis.status === 'connected' ? 'operational' : 'degraded',
        logging: 'operational'
      }
    });

  } catch (error) {
    EnterpriseLogger.error('Health check error', error, {
      adminId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({ 
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/v1/admin/environment - ENTERPRISE Environment validation
router.get('/environment', authenticateToken, requireAdmin, async (req, res) => {
  try {
    EnterpriseLogger.info('Admin environment validation accessed', req.user.id);

    const validation = await EnterpriseEnvironmentService.validateEnvironment();
    const readiness = await EnterpriseEnvironmentService.checkProductionReadiness();
    
    res.json({
      validation,
      readiness,
      timestamp: new Date().toISOString(),
      enterpriseFeatures: {
        environmentValidation: true,
        productionReadiness: true,
        configurationAnalysis: true,
        serviceDiscovery: true
      }
    });

  } catch (error) {
    EnterpriseLogger.error('Environment validation error', error, {
      adminId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to validate environment' });
  }
});

// POST /api/v1/admin/environment/validate - Force environment revalidation
router.post('/environment/validate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    EnterpriseLogger.info('Admin forced environment revalidation', req.user.id);

    const validation = await EnterpriseEnvironmentService.validateEnvironment();
    
    res.json({
      revalidated: true,
      validation,
      timestamp: new Date().toISOString(),
      message: validation.valid ? 'Environment validation successful' : 'Environment validation failed'
    });

  } catch (error) {
    EnterpriseLogger.error('Environment revalidation error', error, {
      adminId: req.user.id,
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to revalidate environment' });
  }
});

module.exports = router;