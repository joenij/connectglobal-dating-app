const express = require('express');
const { authenticateToken } = require('../middleware/security');

const router = express.Router();

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/v1/admin/dashboard - Admin dashboard stats
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // TODO: Fetch real statistics from database
    const stats = {
      users: {
        total: 125000,
        active: 85000,
        verified: 75000,
        newToday: 250
      },
      subscriptions: {
        free: 100000,
        premium: 20000,
        elite: 5000,
        revenue: 450000
      },
      matches: {
        totalMatches: 2500000,
        todayMatches: 15000,
        successRate: 0.23
      },
      safety: {
        reportsToday: 45,
        bannedUsers: 1200,
        moderationQueue: 128
      },
      geography: {
        topCountries: [
          { country: 'US', users: 35000 },
          { country: 'BR', users: 15000 },
          { country: 'IN', users: 12000 },
          { country: 'UK', users: 8000 },
          { country: 'DE', users: 7500 }
        ]
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// GET /api/v1/admin/pricing/modifiers - Get all pricing modifiers
router.get('/pricing/modifiers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // TODO: Fetch from database
    const modifiers = [
      {
        id: 1,
        type: 'disaster',
        name: 'Turkey Earthquake Relief',
        regions: ['TR'],
        discountPercentage: 75,
        startDate: '2023-02-06T00:00:00Z',
        endDate: '2023-05-06T00:00:00Z',
        isActive: true,
        priority: 1
      },
      {
        id: 2,
        type: 'seasonal',
        name: 'Valentine\'s Day Special',
        regions: ['*'],
        discountPercentage: 25,
        startDate: '2024-02-01T00:00:00Z',
        endDate: '2024-02-14T23:59:59Z',
        isActive: false,
        priority: 2
      }
    ];

    res.json({ modifiers });
  } catch (error) {
    console.error('Get pricing modifiers error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing modifiers' });
  }
});

// POST /api/v1/admin/pricing/modifiers - Create pricing modifier
router.post('/pricing/modifiers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, name, regions, discountPercentage, startDate, endDate } = req.body;

    // TODO: Validate and save to database
    const modifier = {
      id: Date.now(),
      type,
      name,
      regions,
      discountPercentage,
      startDate,
      endDate,
      isActive: true,
      priority: 1,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };

    res.status(201).json({ modifier, message: 'Pricing modifier created' });
  } catch (error) {
    console.error('Create pricing modifier error:', error);
    res.status(500).json({ error: 'Failed to create pricing modifier' });
  }
});

// GET /api/v1/admin/reports - Get user reports queue
router.get('/reports', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    // TODO: Fetch reports from database
    const reports = [
      {
        id: 'report-1',
        type: 'inappropriate_content',
        reportedUserId: 12345,
        reportedUser: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        reporterId: 67890,
        reporter: {
          name: 'Jane Smith'
        },
        reason: 'Inappropriate photos',
        evidence: ['photo_url_1', 'photo_url_2'],
        status: 'pending',
        priority: 'high',
        createdAt: new Date().toISOString()
      }
    ];

    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: reports.length,
        hasMore: false
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// POST /api/v1/admin/reports/:id/action - Take action on a report
router.post('/reports/:id/action', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id: reportId } = req.params;
    const { action, reason } = req.body; // action: 'dismiss', 'warn', 'suspend', 'ban'

    // TODO: Process report action in database
    console.log(`Admin ${req.user.id} took action '${action}' on report ${reportId}: ${reason}`);

    res.json({
      reportId,
      action,
      reason,
      processedAt: new Date().toISOString(),
      processedBy: req.user.id,
      message: 'Report processed successfully'
    });
  } catch (error) {
    console.error('Process report error:', error);
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

    // TODO: Search users in database
    const users = [
      {
        id: 12345,
        email: 'john@example.com',
        name: 'John Doe',
        age: 25,
        location: 'New York, US',
        subscriptionTier: 'premium',
        isActive: true,
        isBanned: false,
        createdAt: '2023-01-15T10:00:00Z'
      }
    ];

    res.json({
      users,
      query: q,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: users.length
      }
    });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

module.exports = router;