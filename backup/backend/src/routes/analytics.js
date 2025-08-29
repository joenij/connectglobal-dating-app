const express = require('express');
const { authenticateUser } = require('../middleware/auth');
const { query } = require('../services/database');
const router = express.Router();

/**
 * GET /api/v1/analytics/revenue/dashboard
 * Comprehensive revenue analytics dashboard data
 */
router.get('/revenue/dashboard', authenticateUser, async (req, res) => {
  try {
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString(),
      groupBy = 'day',
      adNetwork = 'admob'
    } = req.query;

    // Total Revenue Summary
    const revenueStats = await query(`
      SELECT 
        COUNT(*) as total_ad_impressions,
        SUM(revenue_usd) as total_revenue_usd,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(revenue_usd) as avg_revenue_per_impression,
        COUNT(CASE WHEN action = 'reward_earned' THEN 1 END) as rewards_earned,
        COUNT(CASE WHEN ad_type = 'banner' THEN 1 END) as banner_impressions,
        COUNT(CASE WHEN ad_type = 'interstitial' THEN 1 END) as interstitial_impressions,
        COUNT(CASE WHEN ad_type = 'rewarded_video' THEN 1 END) as rewarded_impressions
      FROM user_ad_engagement 
      WHERE timestamp BETWEEN $1 AND $2
      AND ad_network = $3
    `, [startDate, endDate, adNetwork]);

    // Revenue Trend by Time Period
    let dateFormat = 'DATE(timestamp)';
    if (groupBy === 'hour') dateFormat = "DATE_TRUNC('hour', timestamp)";
    else if (groupBy === 'week') dateFormat = "DATE_TRUNC('week', timestamp)";
    else if (groupBy === 'month') dateFormat = "DATE_TRUNC('month', timestamp)";

    const revenueTrend = await query(`
      SELECT 
        ${dateFormat} as period,
        SUM(revenue_usd) as revenue,
        COUNT(*) as impressions,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(revenue_usd) as avg_cpm
      FROM user_ad_engagement 
      WHERE timestamp BETWEEN $1 AND $2
      AND ad_network = $3
      GROUP BY ${dateFormat}
      ORDER BY period ASC
    `, [startDate, endDate, adNetwork]);

    // Ad Performance by Type
    const adTypePerformance = await query(`
      SELECT 
        ad_type,
        COUNT(*) as impressions,
        SUM(revenue_usd) as total_revenue,
        AVG(revenue_usd) as avg_revenue_per_impression,
        COUNT(CASE WHEN action = 'click' THEN 1 END) as clicks,
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN action = 'click' THEN 1 END) * 100.0 / COUNT(*))
          ELSE 0 
        END as ctr_percentage,
        COUNT(CASE WHEN action = 'reward_earned' THEN 1 END) as rewards_earned
      FROM user_ad_engagement 
      WHERE timestamp BETWEEN $1 AND $2
      AND ad_network = $3
      GROUP BY ad_type
      ORDER BY total_revenue DESC
    `, [startDate, endDate, adNetwork]);

    // Geographic Performance
    const geoPerformance = await query(`
      SELECT 
        user_country_code,
        COUNT(*) as impressions,
        SUM(revenue_usd) as total_revenue,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(revenue_usd) as avg_revenue_per_user
      FROM user_ad_engagement 
      WHERE timestamp BETWEEN $1 AND $2
      AND ad_network = $3
      AND user_country_code IS NOT NULL
      GROUP BY user_country_code
      ORDER BY total_revenue DESC
      LIMIT 20
    `, [startDate, endDate, adNetwork]);

    // User Tier Performance (Free vs Premium engagement with ads)
    const tierPerformance = await query(`
      SELECT 
        user_subscription_tier,
        COUNT(*) as impressions,
        SUM(revenue_usd) as total_revenue,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN action = 'reward_earned' THEN 1 END) as rewards_earned
      FROM user_ad_engagement 
      WHERE timestamp BETWEEN $1 AND $2
      AND ad_network = $3
      GROUP BY user_subscription_tier
      ORDER BY impressions DESC
    `, [startDate, endDate, adNetwork]);

    // Placement Performance
    const placementPerformance = await query(`
      SELECT 
        placement_location,
        COUNT(*) as impressions,
        SUM(revenue_usd) as total_revenue,
        COUNT(CASE WHEN action = 'click' THEN 1 END) as clicks,
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN action = 'click' THEN 1 END) * 100.0 / COUNT(*))
          ELSE 0 
        END as ctr_percentage
      FROM user_ad_engagement 
      WHERE timestamp BETWEEN $1 AND $2
      AND ad_network = $3
      GROUP BY placement_location
      ORDER BY total_revenue DESC
    `, [startDate, endDate, adNetwork]);

    // Recent High-Value Users (users generating most ad revenue)
    const topRevenueUsers = await query(`
      SELECT 
        user_id,
        COUNT(*) as total_impressions,
        SUM(revenue_usd) as total_revenue,
        COUNT(CASE WHEN action = 'reward_earned' THEN 1 END) as rewards_earned,
        MAX(timestamp) as last_activity,
        user_subscription_tier,
        user_country_code
      FROM user_ad_engagement 
      WHERE timestamp BETWEEN $1 AND $2
      AND ad_network = $3
      GROUP BY user_id, user_subscription_tier, user_country_code
      ORDER BY total_revenue DESC
      LIMIT 50
    `, [startDate, endDate, adNetwork]);

    res.json({
      success: true,
      data: {
        summary: revenueStats.rows[0],
        revenueTrend: revenueTrend.rows,
        adTypePerformance: adTypePerformance.rows,
        geoPerformance: geoPerformance.rows,
        tierPerformance: tierPerformance.rows,
        placementPerformance: placementPerformance.rows,
        topRevenueUsers: topRevenueUsers.rows,
        period: {
          startDate,
          endDate,
          groupBy
        }
      }
    });

  } catch (error) {
    console.error('Revenue dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue analytics'
    });
  }
});

/**
 * GET /api/v1/analytics/revenue/real-time
 * Real-time revenue metrics for live dashboard
 */
router.get('/revenue/real-time', authenticateUser, async (req, res) => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

    // Last 24 hours overview
    const last24HoursStats = await query(`
      SELECT 
        COUNT(*) as impressions_24h,
        SUM(revenue_usd) as revenue_24h,
        COUNT(DISTINCT user_id) as users_24h,
        COUNT(CASE WHEN action = 'reward_earned' THEN 1 END) as rewards_24h
      FROM user_ad_engagement 
      WHERE timestamp >= $1
    `, [last24Hours.toISOString()]);

    // Last hour activity
    const lastHourStats = await query(`
      SELECT 
        COUNT(*) as impressions_1h,
        SUM(revenue_usd) as revenue_1h,
        COUNT(DISTINCT user_id) as users_1h
      FROM user_ad_engagement 
      WHERE timestamp >= $1
    `, [lastHour.toISOString()]);

    // Hourly breakdown for last 24 hours
    const hourlyBreakdown = await query(`
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        COUNT(*) as impressions,
        SUM(revenue_usd) as revenue,
        COUNT(DISTINCT user_id) as unique_users
      FROM user_ad_engagement 
      WHERE timestamp >= $1
      GROUP BY DATE_TRUNC('hour', timestamp)
      ORDER BY hour DESC
    `, [last24Hours.toISOString()]);

    // Active ad placements right now
    const activePlacements = await query(`
      SELECT 
        placement_location,
        COUNT(*) as recent_impressions,
        MAX(timestamp) as last_impression
      FROM user_ad_engagement 
      WHERE timestamp >= $1
      GROUP BY placement_location
      ORDER BY recent_impressions DESC
    `, [lastHour.toISOString()]);

    res.json({
      success: true,
      data: {
        last24Hours: last24HoursStats.rows[0],
        lastHour: lastHourStats.rows[0],
        hourlyBreakdown: hourlyBreakdown.rows,
        activePlacements: activePlacements.rows,
        timestamp: now.toISOString()
      }
    });

  } catch (error) {
    console.error('Real-time analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch real-time analytics'
    });
  }
});

/**
 * GET /api/v1/analytics/user-ltv
 * User Lifetime Value analysis based on ad engagement
 */
router.get('/user-ltv', authenticateUser, async (req, res) => {
  try {
    const { 
      minDays = 7,
      tier = 'all'
    } = req.query;

    const tierFilter = tier !== 'all' ? 'AND user_subscription_tier = $2' : '';
    const params = tier !== 'all' ? [minDays, tier] : [minDays];

    const userLTV = await query(`
      WITH user_metrics AS (
        SELECT 
          user_id,
          user_subscription_tier,
          user_country_code,
          MIN(timestamp) as first_ad_date,
          MAX(timestamp) as last_ad_date,
          COUNT(*) as total_impressions,
          SUM(revenue_usd) as total_revenue,
          COUNT(CASE WHEN action = 'reward_earned' THEN 1 END) as rewards_earned,
          COUNT(DISTINCT DATE(timestamp)) as active_days
        FROM user_ad_engagement 
        WHERE timestamp >= $1::date
        ${tierFilter}
        GROUP BY user_id, user_subscription_tier, user_country_code
        HAVING COUNT(DISTINCT DATE(timestamp)) >= $1
      )
      SELECT 
        user_subscription_tier,
        COUNT(*) as user_count,
        AVG(total_revenue) as avg_ltv,
        AVG(total_impressions) as avg_impressions,
        AVG(rewards_earned) as avg_rewards,
        AVG(active_days) as avg_active_days,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_revenue) as median_ltv,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY total_revenue) as p90_ltv
      FROM user_metrics
      GROUP BY user_subscription_tier
      ORDER BY avg_ltv DESC
    `, params);

    // Cohort analysis by registration month
    const cohortAnalysis = await query(`
      WITH user_cohorts AS (
        SELECT 
          user_id,
          DATE_TRUNC('month', MIN(timestamp)) as cohort_month,
          SUM(revenue_usd) as total_revenue
        FROM user_ad_engagement 
        WHERE timestamp >= $1::date
        GROUP BY user_id
      )
      SELECT 
        cohort_month,
        COUNT(*) as users,
        AVG(total_revenue) as avg_revenue_per_user,
        SUM(total_revenue) as total_cohort_revenue
      FROM user_cohorts
      GROUP BY cohort_month
      ORDER BY cohort_month DESC
    `, [new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()]);

    res.json({
      success: true,
      data: {
        userLTV: userLTV.rows,
        cohortAnalysis: cohortAnalysis.rows
      }
    });

  } catch (error) {
    console.error('User LTV analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user LTV analytics'
    });
  }
});

/**
 * GET /api/v1/analytics/conversion-funnel
 * Ad conversion funnel analysis
 */
router.get('/conversion-funnel', authenticateUser, async (req, res) => {
  try {
    const { 
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate = new Date().toISOString() 
    } = req.query;

    // Conversion funnel for rewarded videos
    const rewardedFunnel = await query(`
      WITH funnel_data AS (
        SELECT 
          user_id,
          session_id,
          MIN(CASE WHEN action = 'impression' AND ad_type = 'rewarded_video' THEN timestamp END) as ad_shown,
          MIN(CASE WHEN action = 'click' AND ad_type = 'rewarded_video' THEN timestamp END) as ad_clicked,
          MIN(CASE WHEN action = 'reward_earned' AND ad_type = 'rewarded_video' THEN timestamp END) as reward_earned
        FROM user_ad_engagement 
        WHERE timestamp BETWEEN $1 AND $2
        AND ad_type = 'rewarded_video'
        GROUP BY user_id, session_id
        HAVING MIN(CASE WHEN action = 'impression' THEN timestamp END) IS NOT NULL
      )
      SELECT 
        COUNT(*) as total_ad_impressions,
        COUNT(ad_clicked) as users_clicked,
        COUNT(reward_earned) as users_earned_reward,
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(ad_clicked) * 100.0 / COUNT(*))
          ELSE 0 
        END as click_rate,
        CASE 
          WHEN COUNT(*) > 0 THEN (COUNT(reward_earned) * 100.0 / COUNT(*))
          ELSE 0 
        END as completion_rate
      FROM funnel_data
    `, [startDate, endDate]);

    // Funnel by placement location
    const placementFunnel = await query(`
      SELECT 
        placement_location,
        ad_type,
        COUNT(CASE WHEN action = 'impression' THEN 1 END) as impressions,
        COUNT(CASE WHEN action = 'click' THEN 1 END) as clicks,
        COUNT(CASE WHEN action = 'reward_earned' THEN 1 END) as rewards,
        CASE 
          WHEN COUNT(CASE WHEN action = 'impression' THEN 1 END) > 0 
          THEN (COUNT(CASE WHEN action = 'click' THEN 1 END) * 100.0 / COUNT(CASE WHEN action = 'impression' THEN 1 END))
          ELSE 0 
        END as ctr,
        CASE 
          WHEN COUNT(CASE WHEN action = 'impression' THEN 1 END) > 0 
          THEN (COUNT(CASE WHEN action = 'reward_earned' THEN 1 END) * 100.0 / COUNT(CASE WHEN action = 'impression' THEN 1 END))
          ELSE 0 
        END as completion_rate
      FROM user_ad_engagement 
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY placement_location, ad_type
      ORDER BY impressions DESC
    `, [startDate, endDate]);

    res.json({
      success: true,
      data: {
        rewardedVideoFunnel: rewardedFunnel.rows[0],
        placementFunnels: placementFunnel.rows
      }
    });

  } catch (error) {
    console.error('Conversion funnel error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversion funnel data'
    });
  }
});

module.exports = router;