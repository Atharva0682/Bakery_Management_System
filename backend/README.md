# Smart Bakery Management System — Backend API

RESTful API backend for the **Smart Bakery Management System** built with **Node.js**, **Express.js**, **PostgreSQL**, and **JWT**.

---

## 1. Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (using `pg` Connection Pool)
- **Authentication**: JSON Web Tokens (JWT) + Bcrypt.js password hashing
- **Security & Utilities**: CORS, Dotenv

---

## 2. Directory Structure

```text
backend/
├── src/
│   ├── config/          # Database connection pool and environmental configuration
│   ├── controllers/     # Request handlers and business logic coordination
│   ├── middleware/      # JWT authentication, role authorization, validation
│   ├── models/          # PostgreSQL query builders and database models
│   ├── routes/          # Express route definitions (auth, products, batches, orders)
│   ├── services/        # Domain business logic (cost calculations, FIFO deduction)
│   ├── utils/           # Helper utilities, responses, QR generators
│   └── server.js        # Main Express server entry point
│
├── .env                 # Environment variables
├── package.json         # Node.js project manifest & dependencies
└── README.md            # Backend documentation
```

---

## 3. Setup & Installation

### Prerequisites
- Node.js (v18+)
- PostgreSQL (v14+) running locally or via Docker

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Update the `.env` file with your local database credentials:
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=bakery_db
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
```

### 3. Initialize Database
Execute the database schema and seed data in your PostgreSQL instance:
```bash
# Using psql
psql -U postgres -d bakery_db -f ../database/schema.md
psql -U postgres -d bakery_db -f ../database/seed-data.md
```

### 4. Run Server
```bash
# Development mode with auto-reload
npm run dev

# Production start
npm start
```

---

## 4. API Endpoints Overview

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Health check endpoint | No |
| `POST` | `/api/auth/login` | User login (returns JWT token) | No |
| `POST` | `/api/auth/register` | Customer registration | No |
| `GET` | `/api/products` | Browse product catalog & variants | No |
| `POST` | `/api/orders` | Place a customer order | Yes (Customer) |
| `POST` | `/api/payments/verify-qr` | Verify UPI / QR payment | Yes (Manager/Owner) |
| `GET` | `/api/production/batches` | View production batches | Yes (Baker/Manager) |
| `POST` | `/api/production/batches` | Schedule new production batch | Yes (Manager/Owner) |
| `GET` | `/api/inventory/materials` | Real-time stock & reorder alerts | Yes (Staff) |
| `POST` | `/api/inventory/wastage` | Log material/batch wastage | Yes (Baker/Manager) |
