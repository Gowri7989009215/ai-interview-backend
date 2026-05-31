# ProInterview AI — Production SaaS Backend

This is the production-grade, enterprise-scale backend API for **ProInterview AI**. It handles database persistence, user authentication, VM-sandboxed coding rounds, voice mock sessions, rate limiting, anti-cheat detection, and hybrid LLM generation/evaluation with local self-healing fallbacks.

---

## 🛠️ Tech Stack & Key Abstractions

- **Core**: Node.js, Express
- **Database**: MongoDB & Mongoose
- **Security & Session**: JWT Access/Refresh token rotation, Helmet secure headers, cookie-parser, Express Rate Limiters (100 requests per 15 mins)
- **Email Delivery**: Nodemailer (supporting SMTP with fallback to console logging)
- **AI Integrations**: Claude 3.5 Sonnet (via `@anthropic-ai/sdk`) with Gemini 1.5 Flash fallback, plus a robust **local rules-based heuristic parser/generator** for self-healing capability
- **Code Execution Sandbox**: Secure Javascript evaluation using the Node native `vm` module

---

## ⚙️ Environment Variables Configuration

Create a `.env` file in this directory with the following variables:

```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/dbname

# Authentication & Token Security
JWT_SECRET=your_transient_jwt_secret_key
JWT_REFRESH_SECRET=your_longlived_jwt_refresh_secret_key

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI API Configurations
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key

# SMTP Configuration (Email Verification)
# If unconfigured/blank, OTP codes will fallback to console logging for local testing.
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
SMTP_SECURE=false
EMAIL_FROM="ProInterview AI <noreply@yourdomain.com>"
OTP_EXPIRY_MINUTES=10
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Developer Mode (Nodemon Auto-Reload)
```bash
npm run dev
```

### 3. Start Production Server
```bash
npm start
```

The server will initialize on port `5000`. By default, MongoDB connection triggers the seeding of a default administrative account:
- **Email**: `admin@prointerview.ai`
- **Password**: `adminpassword123`

---

## 📂 Architecture Overview

```
server/
├── controllers/       # Handlers (Auth, Resume, Interview, Dashboard, Admin)
├── middleware/        # Authentication & Role Validation middlewares
├── models/            # Mongoose Schemas (User, Resume, Interview, Report, etc.)
├── routes/            # Route maps (/api/auth, /api/resume, /api/interview, etc.)
├── services/          # LLM integrations (claudeService) & Heuristic Fallbacks
├── utils/             # VM Sandbox compiler, Email helper
├── uploads/           # PDF Resumes destination folder (Git-ignored)
├── index.js           # Server application bootstrapper
└── package.json       # Dependencies list
```
