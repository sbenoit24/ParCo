# Exchequer Backend Deployment Guide

This guide covers deploying the Exchequer backend server to various hosting platforms with proper Stripe integration.

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ installed
- Stripe account with API keys
- Firebase project with service account
- Git repository access

### Local Development Setup

```bash
# Clone repository
git clone <your-repo-url>
cd exchequer

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Edit environment variables
nano .env

# Start development server
npm run dev
```

## 🌐 Deployment Options

### 1. Heroku Deployment

#### Setup
```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login to Heroku
heroku login

# Create Heroku app
heroku create your-exchequer-app

# Add environment variables
heroku config:set NODE_ENV=production
heroku config:set STRIPE_SECRET_KEY=sk_live_your_key
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_your_key
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
heroku config:set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
heroku config:set FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# Deploy
git push heroku main
```

#### Heroku Add-ons
```bash
# Add monitoring
heroku addons:create papertrail:choklad

# Add logging
heroku addons:create logentries:le_tryit

# Add SSL
heroku addons:create heroku-ssl
```

### 2. Vercel Deployment

#### Setup
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Vercel Configuration
Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### 3. AWS EC2 Deployment

#### Server Setup
```bash
# Connect to EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Clone repository
git clone <your-repo-url>
cd exchequer

# Install dependencies
npm install

# Setup environment
cp env.example .env
nano .env
```

#### PM2 Configuration
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'exchequer-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

#### Start with PM2
```bash
# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 4. Google Cloud Run

#### Setup
```bash
# Install Google Cloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Login to Google Cloud
gcloud auth login

# Set project
gcloud config set project your-project-id

# Enable APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

#### Deploy
```bash
# Build and deploy
gcloud run deploy exchequer-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

## 🔧 Environment Configuration

### Production Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com

# Stripe Configuration (Production Keys)
STRIPE_SECRET_KEY=sk_live_your_production_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_production_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret

# Firebase Configuration
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Security
JWT_SECRET=your_very_secure_jwt_secret
SESSION_SECRET=your_very_secure_session_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

### Stripe Production Setup

1. **Switch to Live Mode**
   - Go to Stripe Dashboard
   - Toggle to "Live" mode
   - Get live API keys

2. **Configure Webhooks**
   - Add production webhook endpoint
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
   - Copy webhook secret

3. **Test Live Payments**
   - Use real card numbers for testing
   - Monitor payments in Stripe Dashboard

## 🔒 Security Best Practices

### SSL/TLS Configuration
```javascript
// In server.js
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem')
};

https.createServer(options, app).listen(443);
```

### Rate Limiting
```javascript
// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### CORS Configuration
```javascript
// Production CORS
app.use(cors({
  origin: ['https://your-frontend-domain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

## 📊 Monitoring & Logging

### Health Checks
```bash
# Test health endpoint
curl https://your-domain.com/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "production"
}
```

### Logging Setup
```javascript
// Add to server.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

### Error Tracking
```javascript
// Add Sentry for error tracking
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

## 🔄 CI/CD Pipeline

### GitHub Actions Example
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Deploy to Heroku
      uses: akhileshns/heroku-deploy@v3.12.14
      with:
        heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
        heroku_app_name: ${{ secrets.HEROKU_APP_NAME }}
        heroku_email: ${{ secrets.HEROKU_EMAIL }}
```

## 🧪 Testing

### API Testing
```bash
# Test payment intent creation
curl -X POST https://your-domain.com/api/payments/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000,
    "currency": "usd",
    "memberId": "test-member",
    "organizationId": "test-org",
    "description": "Test Dues Payment"
  }'

# Test health endpoint
curl https://your-domain.com/api/health
```

### Load Testing
```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run load-test.yml
```

Create `load-test.yml`:
```yaml
config:
  target: 'https://your-domain.com'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Content-Type: 'application/json'

scenarios:
  - name: "Health Check"
    flow:
      - get:
          url: "/api/health"
```

## 🚨 Troubleshooting

### Common Issues

1. **Stripe Webhook Failures**
   ```bash
   # Check webhook logs
   heroku logs --tail
   
   # Verify webhook endpoint
   curl -X POST https://your-domain.com/api/webhooks/stripe
   ```

2. **Firebase Connection Issues**
   ```bash
   # Test Firebase connection
   node -e "
   const admin = require('firebase-admin');
   admin.initializeApp({
     credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
   });
   console.log('Firebase connected successfully');
   "
   ```

3. **CORS Errors**
   ```javascript
   // Check CORS configuration
   app.use(cors({
     origin: true, // Allow all origins in development
     credentials: true
   }));
   ```

### Performance Optimization

1. **Database Indexing**
   ```javascript
   // Add indexes to Firestore collections
   // This should be done in Firebase Console
   ```

2. **Caching**
   ```javascript
   // Add Redis caching
   const redis = require('redis');
   const client = redis.createClient();
   
   // Cache payment history
   app.get('/api/payments/history/:org/:member', async (req, res) => {
     const cacheKey = `payments:${req.params.org}:${req.params.member}`;
     const cached = await client.get(cacheKey);
     
     if (cached) {
       return res.json(JSON.parse(cached));
     }
     
     // Fetch from database and cache
   });
   ```

## 📈 Scaling Considerations

### Horizontal Scaling
- Use load balancers
- Implement session sharing
- Use external databases

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Implement caching strategies

### Monitoring
- Set up alerts for errors
- Monitor response times
- Track payment success rates

---

**Next Steps:**
1. Choose your deployment platform
2. Set up environment variables
3. Configure Stripe webhooks
4. Test the deployment
5. Monitor performance
6. Set up monitoring and alerts

For additional support, refer to the platform-specific documentation or create an issue in the repository. 