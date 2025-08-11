const express = require('express');
const { authenticateToken } = require('../middleware/security');
const Match = require('../models/Match');

const router = express.Router();

// GET /api/v1/matching/discover - Get potential matches
router.get('/discover', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    console.log(`Fetching potential matches for user ${req.user.id}, limit: ${limit}`);
    
    const profiles = await Match.getPotentialMatches(req.user.id, limit);
    console.log(`Found ${profiles.length} potential matches`);

    res.json({
      profiles: profiles,
      totalCount: profiles.length
    });
  } catch (error) {
    console.error('Discover error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profiles',
      debug: error.message 
    });
  }
});

// POST /api/v1/matching/action - Like/pass on a profile
router.post('/action', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, action } = req.body; // action: 'like', 'pass', 'super_like'
    
    if (!targetUserId || !action) {
      return res.status(400).json({ error: 'Target user ID and action required' });
    }

    if (!['like', 'pass', 'super_like'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be like, pass, or super_like' });
    }

    const result = await Match.recordAction(req.user.id, targetUserId, action);

    res.json({
      action: result.action,
      targetUserId: targetUserId,
      isMatch: result.isMatch,
      message: result.isMatch ? "It's a match! 🎉" : 'Action recorded'
    });
  } catch (error) {
    console.error('Match action error:', error);
    res.status(500).json({ error: 'Failed to process action' });
  }
});

// GET /api/v1/matching/matches - Get user's matches
router.get('/matches', authenticateToken, async (req, res) => {
  try {
    const matches = await Match.getUserMatches(req.user.id);

    res.json({
      matches: matches,
      totalCount: matches.length
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

module.exports = router;