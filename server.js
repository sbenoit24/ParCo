const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin
let adminApp;
try {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount && process.env.FIREBASE_DATABASE_URL) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    console.log('Firebase Admin initialized successfully');
  } else {
    console.log('Firebase credentials not configured - running in demo mode');
    adminApp = null;
  }
} catch (error) {
  console.log('Firebase initialization failed - running in demo mode:', error.message);
  adminApp = null;
}

const db = adminApp ? admin.firestore() : null;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Validation middleware
const validatePaymentIntent = [
  body('amount').isInt({ min: 50 }).withMessage('Amount must be at least 50 cents'),
  body('currency').isIn(['usd']).withMessage('Currency must be USD'),
  body('memberId').notEmpty().withMessage('Member ID is required'),
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
  body('description').notEmpty().withMessage('Description is required')
];

const validateExpenseReimbursement = [
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('memberId').notEmpty().withMessage('Member ID is required'),
  body('organizationId').notEmpty().withMessage('Organization ID is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('receiptUrl').optional().isURL().withMessage('Receipt URL must be valid')
];

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    demo: true,
    features: ['expense-submission', 'payment-processing', 'stripe-integration']
  });
});

// Create payment intent for dues collection
app.post('/api/payments/create-payment-intent', validatePaymentIntent, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { amount, currency, memberId, organizationId, description } = req.body;

    // Create or retrieve Stripe customer
    let customer;
    let memberData = { name: 'Demo Member', email: 'demo@example.com' };
    
    if (db) {
      const memberRef = db.collection('artifacts').doc(organizationId)
        .collection('users').doc(memberId)
        .collection('members').doc(memberId);
      
      const memberDoc = await memberRef.get();
      if (!memberDoc.exists) {
        return res.status(404).json({ error: 'Member not found' });
      }

      memberData = memberDoc.data();
    } else {
      console.log('Running in demo mode - using default member data');
    }

    const customerEmail = memberData.email;

    // Check if customer already exists in Stripe
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: customerEmail,
        name: memberData.name,
        metadata: {
          memberId,
          organizationId
        }
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer.id,
      description,
      metadata: {
        memberId,
        organizationId,
        paymentType: 'dues',
        memberName: memberData.name
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Log the payment intent creation
    if (db) {
      await db.collection('artifacts').doc(organizationId)
        .collection('users').doc(memberId)
        .collection('payment_intents').add({
          paymentIntentId: paymentIntent.id,
          amount,
          currency,
          status: paymentIntent.status,
          description,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          memberId,
          memberName: memberData.name
        });
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ 
      error: 'Failed to create payment intent',
      message: error.message 
    });
  }
});

// Handle successful payment webhook
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      case 'charge.refunded':
        await handleRefund(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle payment success
async function handlePaymentSuccess(paymentIntent) {
  const { memberId, organizationId, paymentType, memberName } = paymentIntent.metadata;
  
  try {
    // Update dues status
    const duesRef = db.collection('artifacts').doc(organizationId)
      .collection('users').doc(memberId)
      .collection('dues').doc(memberId);
    
    await duesRef.set({
      memberName,
      amount: paymentIntent.amount / 100, // Convert from cents
      status: 'Paid',
      dueDate: new Date().toISOString().split('T')[0],
      paidDate: new Date().toISOString().split('T')[0],
      paymentIntentId: paymentIntent.id,
      stripeChargeId: paymentIntent.latest_charge
    }, { merge: true });

    // Create donation record if it's a donation
    if (paymentType === 'donation') {
      await db.collection('artifacts').doc(organizationId)
        .collection('users').doc(memberId)
        .collection('donations').add({
          campaignName: paymentIntent.description,
          donorName: memberName,
          amount: paymentIntent.amount / 100,
          date: new Date().toISOString().split('T')[0],
          paymentIntentId: paymentIntent.id
        });
    }

    console.log(`Payment succeeded for member ${memberName} in organization ${organizationId}`);
  } catch (error) {
    console.error('Error updating payment success:', error);
  }
}

// Handle payment failure
async function handlePaymentFailure(paymentIntent) {
  const { memberId, organizationId, memberName } = paymentIntent.metadata;
  
  try {
    // Update dues status to failed
    const duesRef = db.collection('artifacts').doc(organizationId)
      .collection('users').doc(memberId)
      .collection('dues').doc(memberId);
    
    await duesRef.set({
      memberName,
      amount: paymentIntent.amount / 100,
      status: 'Failed',
      dueDate: new Date().toISOString().split('T')[0],
      paymentIntentId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message || 'Payment failed'
    }, { merge: true });

    console.log(`Payment failed for member ${memberName} in organization ${organizationId}`);
  } catch (error) {
    console.error('Error updating payment failure:', error);
  }
}

// Handle refund
async function handleRefund(charge) {
  try {
    // Find the payment intent to get metadata
    const paymentIntent = await stripe.paymentIntents.retrieve(charge.payment_intent);
    const { memberId, organizationId, memberName } = paymentIntent.metadata;
    
    // Update dues status to refunded
    const duesRef = db.collection('artifacts').doc(organizationId)
      .collection('users').doc(memberId)
      .collection('dues').doc(memberId);
    
    await duesRef.set({
      memberName,
      amount: charge.amount_refunded / 100,
      status: 'Refunded',
      refundDate: new Date().toISOString().split('T')[0],
      refundId: charge.refunds.data[0].id
    }, { merge: true });

    console.log(`Refund processed for member ${memberName} in organization ${organizationId}`);
  } catch (error) {
    console.error('Error updating refund:', error);
  }
}

// Submit expense with payment processing
app.post('/api/expenses/submit', [
  body('submitterName').notEmpty().withMessage('Submitter name is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('category').notEmpty().withMessage('Category is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('memberId').notEmpty().withMessage('Member ID is required'),
  body('organizationId').notEmpty().withMessage('Organization ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { submitterName, amount, category, description, memberId, organizationId, receiptUrl } = req.body;

    // Create expense record
    const expenseData = {
      submitterName,
      amount: parseFloat(amount),
      category,
      description,
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      receiptUrl: receiptUrl || '',
      submittedAt: new Date().toISOString(),
      memberId,
      organizationId
    };

    // Save to database if available
    if (db) {
      await db.collection('artifacts').doc(organizationId)
        .collection('users').doc(memberId)
        .collection('expenses').add(expenseData);
    }

    // Create payment intent for the expense amount
    let customer;
    let memberData = { name: submitterName, email: 'demo@example.com' };
    
    if (db) {
      const memberRef = db.collection('artifacts').doc(organizationId)
        .collection('users').doc(memberId)
        .collection('members').doc(memberId);
      
      const memberDoc = await memberRef.get();
      if (memberDoc.exists) {
        memberData = memberDoc.data();
      }
    }

    // Demo mode - return mock payment intent if Stripe not configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_your_stripe_secret_key_here') {
      console.log('Running in demo mode - returning mock payment intent for expense');
      return res.json({
        success: true,
        expenseId: Date.now().toString(),
        paymentIntentId: 'pi_mock_expense_' + Date.now(),
        clientSecret: 'pi_mock_secret_' + Date.now(),
        demo: true,
        message: 'Expense submitted successfully! (Demo mode - no payment required)'
      });
    }

    // Check if Stripe is properly initialized
    if (!stripe || !process.env.STRIPE_SECRET_KEY) {
      console.log('Stripe not properly configured - returning demo response');
      return res.json({
        success: true,
        expenseId: Date.now().toString(),
        paymentIntentId: 'pi_mock_expense_' + Date.now(),
        clientSecret: 'pi_mock_secret_' + Date.now(),
        demo: true,
        message: 'Expense submitted successfully! (Demo mode - no payment required)'
      });
    }

    // Create or retrieve Stripe customer
    try {
      const existingCustomers = await stripe.customers.list({
        email: memberData.email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        customer = await stripe.customers.create({
          email: memberData.email,
          name: memberData.name,
          metadata: {
            memberId,
            organizationId
          }
        });
      }

      // Create payment intent for expense
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(amount) * 100), // Convert to cents
        currency: 'usd',
        customer: customer.id,
        description: `Expense: ${description}`,
        metadata: {
          memberId,
          organizationId,
          paymentType: 'expense',
          memberName: memberData.name,
          category,
          expenseId: Date.now().toString()
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.json({
        success: true,
        expenseId: Date.now().toString(),
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        message: 'Expense submitted successfully. Payment required to complete submission.'
      });
    } catch (stripeError) {
      console.error('Stripe error:', stripeError);
      // Fallback to demo mode if Stripe fails
      return res.json({
        success: true,
        expenseId: Date.now().toString(),
        paymentIntentId: 'pi_mock_expense_' + Date.now(),
        clientSecret: 'pi_mock_secret_' + Date.now(),
        demo: true,
        message: 'Expense submitted successfully! (Demo mode - Stripe error handled)'
      });
    }

  } catch (error) {
    console.error('Error submitting expense:', error);
    res.status(500).json({ 
      error: 'Failed to submit expense',
      message: error.message 
    });
  }
});

// Process expense reimbursement
app.post('/api/expenses/process-reimbursement', validateExpenseReimbursement, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }

    const { amount, memberId, organizationId, description, receiptUrl } = req.body;

    // Get member data
    const memberRef = db.collection('artifacts').doc(organizationId)
      .collection('users').doc(memberId)
      .collection('members').doc(memberId);
    
    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const memberData = memberDoc.data();

    // Create or retrieve Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: memberData.email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: memberData.email,
        name: memberData.name,
        metadata: {
          memberId,
          organizationId
        }
      });
    }

    // Create transfer to customer's bank account (simulated)
    // In a real implementation, you'd need to collect bank account details
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      destination: customer.id, // This would be a connected account in real implementation
      description: `Reimbursement: ${description}`,
      metadata: {
        memberId,
        organizationId,
        memberName: memberData.name,
        expenseType: 'reimbursement'
      }
    });

    // Update expense status
    const expenseRef = db.collection('artifacts').doc(organizationId)
      .collection('users').doc(memberId)
      .collection('expenses').doc(req.body.expenseId);
    
    await expenseRef.set({
      status: 'Reimbursed',
      reimbursementDate: new Date().toISOString().split('T')[0],
      transferId: transfer.id,
      receiptUrl: receiptUrl || ''
    }, { merge: true });

    res.json({
      success: true,
      transferId: transfer.id,
      message: 'Reimbursement processed successfully'
    });

  } catch (error) {
    console.error('Error processing reimbursement:', error);
    res.status(500).json({ 
      error: 'Failed to process reimbursement',
      message: error.message 
    });
  }
});

// Get payment history for a member
app.get('/api/payments/history/:organizationId/:memberId', async (req, res) => {
  try {
    const { organizationId, memberId } = req.params;
    
    const paymentsRef = db.collection('artifacts').doc(organizationId)
      .collection('users').doc(memberId)
      .collection('payment_intents');
    
    const snapshot = await paymentsRef.orderBy('createdAt', 'desc').get();
    const payments = [];
    
    snapshot.forEach(doc => {
      payments.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json({ payments });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch payment history',
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Exchequer Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💳 Stripe integration: ${process.env.STRIPE_SECRET_KEY ? 'Enabled' : 'Disabled'}`);
});

module.exports = app; 