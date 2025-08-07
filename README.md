# Exchequer - Student Organization Financial Management Platform

A modern, all-in-one financial and membership management platform designed specifically for student organizations, starting with college clubs, fraternities, and sororities.

## 🚀 Features

- **💳 Dues Collection** - Stripe-powered payment processing
- **🧾 Expense Management** - Submit, approve, and reimburse expenses
- **👥 Member Management** - Track roles, permissions, and member data
- **📅 Event Calendar** - Create and manage organization events
- **📊 Financial Dashboard** - Real-time financial health monitoring
- **🎯 Fundraising Campaigns** - Donation tracking and progress monitoring
- **💰 Budget Planning** - AI-assisted budgeting and financial planning

## 🏗️ Architecture

### Frontend
- **Single Page Application** - Built with vanilla JavaScript, HTML, and CSS
- **Responsive Design** - Mobile-friendly interface using Tailwind CSS
- **Real-time Updates** - Firebase integration for live data synchronization
- **Chart Visualization** - Chart.js for financial data visualization

### Backend
- **Express.js Server** - RESTful API endpoints
- **Stripe Integration** - Secure payment processing
- **Firebase Admin** - Server-side database operations
- **Webhook Handling** - Payment confirmation and status updates
- **Security Middleware** - Rate limiting, CORS, and input validation

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Stripe account with API keys
- Firebase project with Firestore database

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd exchequer
npm install
```

### 2. Environment Configuration

Copy the environment example file and configure your settings:

```bash
cp env.example .env
```

Edit `.env` with your actual values:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8000

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_actual_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret

# Firebase Configuration
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### 3. Stripe Setup

1. **Create a Stripe Account**
   - Sign up at [stripe.com](https://stripe.com)
   - Get your API keys from the dashboard

2. **Configure Webhooks**
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/webhooks/stripe`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
   - Copy the webhook secret to your `.env` file

3. **Test Mode**
   - Use test API keys for development
   - Use test card numbers: `4242 4242 4242 4242`

### 4. Firebase Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Create a new project

2. **Enable Firestore**
   - Go to Firestore Database
   - Create database in test mode

3. **Generate Service Account**
   - Go to Project Settings → Service Accounts
   - Generate new private key
   - Save the JSON file as `firebase-service-account.json` in the project root

### 5. Start the Backend Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

### 6. Start the Frontend

```bash
# Using Python's built-in server
python3 -m http.server 8000

# Or using Node.js http-server
npx http-server -p 8000
```

The frontend will be available at `http://localhost:8000`

## 🔌 API Endpoints

### Payment Processing
- `POST /api/payments/create-payment-intent` - Create Stripe payment intent
- `POST /api/webhooks/stripe` - Handle Stripe webhooks
- `GET /api/payments/history/:organizationId/:memberId` - Get payment history

### Expense Management
- `POST /api/expenses/process-reimbursement` - Process expense reimbursements

### Health Check
- `GET /api/health` - Server health status

## 💳 Payment Flow

1. **Dues Collection**
   - Member clicks "Pay Dues" button
   - Frontend calls `/api/payments/create-payment-intent`
   - Stripe Elements form is displayed
   - Payment is processed through Stripe
   - Webhook updates member's dues status

2. **Expense Reimbursement**
   - Treasurer approves expense
   - Backend processes reimbursement via Stripe Transfers
   - Member receives payment to their bank account
   - Expense status is updated to "Reimbursed"

## 🔒 Security Features

- **Rate Limiting** - Prevents API abuse
- **Input Validation** - Sanitizes all user inputs
- **CORS Protection** - Restricts cross-origin requests
- **Helmet.js** - Security headers
- **Environment Variables** - Secure configuration management

## 🧪 Testing

```bash
# Run tests
npm test

# Test payment flow
curl -X POST http://localhost:3000/api/payments/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000,
    "currency": "usd",
    "memberId": "test-member",
    "organizationId": "test-org",
    "description": "Fall Semester Dues"
  }'
```

## 🚀 Deployment

### Environment Variables
- Set `NODE_ENV=production`
- Use production Stripe keys
- Configure production Firebase project
- Set up proper CORS origins

### Hosting Options
- **Heroku** - Easy deployment with add-ons
- **Vercel** - Serverless deployment
- **AWS EC2** - Full control over server
- **Google Cloud Run** - Containerized deployment

## 📊 Monitoring

- **Health Checks** - `/api/health` endpoint
- **Logging** - Console and file-based logging
- **Error Tracking** - Comprehensive error handling
- **Payment Monitoring** - Stripe Dashboard integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

---

**Exchequer** - Making student organization management suck less! 🎓 