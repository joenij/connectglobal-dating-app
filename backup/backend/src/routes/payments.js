const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { authenticateToken } = require('../middleware/security');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const EnterpriseLogger = require('../services/EnterpriseLoggerService');

const router = express.Router();

// Create payment intent for premium subscription
router.post('/create-payment-intent', [
  authenticateToken,
  body('plan').isIn(['basic', 'premium', 'ultimate']),
  body('billing_cycle').isIn(['monthly', 'yearly'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { plan, billing_cycle } = req.body;
    const userId = req.user.id;

    // Get user for country-based pricing
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Price calculation based on plan and country
    const prices = {
      basic: {
        monthly: { US: 999, DE: 899, IN: 299 }, // cents
        yearly: { US: 9999, DE: 8999, IN: 2999 }
      },
      premium: {
        monthly: { US: 1999, DE: 1799, IN: 599 },
        yearly: { US: 19999, DE: 17999, IN: 5999 }
      },
      ultimate: {
        monthly: { US: 4999, DE: 4499, IN: 1499 },
        yearly: { US: 49999, DE: 44999, IN: 14999 }
      }
    };

    const country = user.country || 'US';
    const amount = prices[plan][billing_cycle][country] || prices[plan][billing_cycle]['US'];

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: country === 'DE' ? 'eur' : country === 'IN' ? 'inr' : 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: userId.toString(),
        plan,
        billing_cycle
      }
    });

    res.json({
      client_secret: paymentIntent.client_secret,
      amount,
      currency: paymentIntent.currency
    });

  } catch (error) {
    EnterpriseLogger.error('Payment intent creation error', error, { userId: req.user.id, plan: req.body.plan, billingCycle: req.body.billing_cycle, ip: req.ip });
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Webhook to handle successful payments
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    EnterpriseLogger.security('Webhook signature verification failed', {
      error: err.message,
      ip: req.ip,
      headers: req.headers,
      action: 'BLOCKED_INVALID_WEBHOOK'
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      const { userId, plan, billing_cycle } = paymentIntent.metadata;

      try {
        // Calculate subscription end date
        const now = new Date();
        const endDate = new Date(now);
        if (billing_cycle === 'yearly') {
          endDate.setFullYear(now.getFullYear() + 1);
        } else {
          endDate.setMonth(now.getMonth() + 1);
        }

        // Update user subscription
        await User.updateSubscription(userId, {
          subscription_plan: plan,
          subscription_status: 'active',
          subscription_start: now.toISOString(),
          subscription_end: endDate.toISOString(),
          billing_cycle,
          stripe_payment_intent_id: paymentIntent.id
        });

        EnterpriseLogger.info('Subscription activated', userId, {
          subscriptionId: session.subscription,
          customerEmail: session.customer_email,
          amount: session.amount_total
        });
      } catch (error) {
        EnterpriseLogger.error('Error updating subscription', error, {
          userId,
          subscriptionId: session.subscription,
          customerEmail: session.customer_email
        });
      }
      break;

    case 'payment_intent.payment_failed':
      EnterpriseLogger.error('Payment failed', null, {
        paymentIntentId: event.data.object.id,
        amount: event.data.object.amount,
        currency: event.data.object.currency,
        failureCode: event.data.object.last_payment_error?.code
      });
      break;

    default:
      EnterpriseLogger.info('Unhandled webhook event type', null, {
        eventType: event.type,
        eventId: event.id
      });
  }

  res.json({received: true});
});

// Get user's current subscription status
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscription = {
      plan: user.subscription_plan || 'free',
      status: user.subscription_status || 'inactive',
      start: user.subscription_start,
      end: user.subscription_end,
      billing_cycle: user.billing_cycle
    };

    // Check if subscription is still active
    if (subscription.end && new Date(subscription.end) < new Date()) {
      subscription.status = 'expired';
    }

    res.json({ subscription });
  } catch (error) {
    EnterpriseLogger.error('Get subscription error', error, { userId: req.user.id, ip: req.ip });
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// Cancel subscription
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await User.updateSubscription(userId, {
      subscription_status: 'cancelled',
      subscription_end: new Date().toISOString()
    });

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    EnterpriseLogger.error('Cancel subscription error', error, { userId: req.user.id, ip: req.ip });
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;