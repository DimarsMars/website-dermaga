# Dock Pre-Booking Monitoring System

Sistem monitoring pre-booking dermaga untuk Dermaga Timur, Pelabuhan Benoa. Aplikasi web realtime yang memungkinkan agen kapal mengajukan permintaan sandar, petugas operasional memvalidasi dan menyetujui/menolak permintaan, serta semua pengguna memantau ketersediaan dermaga melalui berthing plan 2D interaktif.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js 18, Tailwind CSS, Vite |
| Backend | Express.js, Node.js |
| Database | PostgreSQL 14+ |
| Realtime | Socket.io (WebSocket) |
| Authentication | JWT (Access + Refresh Token) |
| Validation | Joi (server-side) |

## Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **PostgreSQL** 14+ (or use Docker)
- **npm** 9+
- **Git**

## Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd website-dermaga-testing
```

### 2. Install dependencies

```bash
npm run install:all
```

This installs dependencies for the root, server, and client workspaces.

### 3. Configure environment variables

```bash
# Copy the example env file
cp .env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` with your database credentials and JWT secrets.

### 4. Set up the database

Make sure PostgreSQL is running, then create the database:

```bash
# Create the database (if not exists)
createdb dock_prebooking

# Run migrations
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed
```

### 5. Start development

```bash
npm run dev
```

This starts both the client (port 5173) and server (port 5000) concurrently.

## Development Workflow

```bash
# Start both client and server in development mode
npm run dev

# Start only the server (with nodemon hot-reload)
npm run dev:server

# Start only the client (Vite dev server with HMR)
npm run dev:client

# Run database migrations
npm run db:migrate

# Seed the database
npm run db:seed

# Fresh database (drop all tables + re-migrate)
npm run db:fresh

# Run tests
npm run test
```

## Production Deployment

### Build and run locally

```bash
# Build the client (outputs to /client/dist)
npm run build

# Start the production server (serves API + static frontend)
npm start
```

In production mode, Express serves the built React app from `/client/dist` as static files. A single Node.js process handles both the API and the frontend.

### Using Docker Compose

```bash
# Start PostgreSQL + app containers
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Stop and remove volumes (reset database)
docker-compose down -v
```

## Project Structure

```
website-dermaga-testing/
├── client/                    # React.js SPA (Vite)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page-level components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API & Socket.io clients
│   │   ├── context/           # React Context providers
│   │   └── utils/             # Constants & helpers
│   ├── dist/                  # Production build output
│   └── package.json
├── server/                    # Express.js API
│   ├── src/
│   │   ├── routes/            # API route definitions
│   │   ├── controllers/       # Request handlers
│   │   ├── services/          # Business logic
│   │   ├── models/            # Database queries
│   │   ├── middleware/        # Auth, validation, RBAC
│   │   ├── config/            # DB pool, Socket.io setup
│   │   ├── database/          # Migrations & seeds
│   │   ├── utils/             # PDF generation, constants
│   │   ├── app.js             # Express app configuration
│   │   └── index.js           # Server entry point
│   └── package.json
├── docker-compose.yml         # Local dev with PostgreSQL
├── .env.example               # Environment variables reference
├── package.json               # Root scripts (monorepo)
└── README.md
```

## API Documentation

### Authentication

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/register` | Agent registration | Public |
| POST | `/api/auth/login` | User login (all roles) | Public |
| POST | `/api/auth/reset-password` | Password reset | Public |
| POST | `/api/auth/create-officer` | Create officer account | Admin |
| POST | `/api/auth/create-admin` | Create admin account | Admin |

### Bookings

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/bookings` | List bookings | All (filtered by role) |
| GET | `/api/bookings/:id` | Get booking detail | All |
| POST | `/api/bookings` | Submit pre-booking | Agent |
| POST | `/api/bookings/manual` | Manual entry | Officer/Admin |
| PUT | `/api/bookings/:id/approve` | Approve booking | Officer |
| PUT | `/api/bookings/:id/reject` | Reject booking | Officer |
| PUT | `/api/bookings/:id/position` | Edit position | Officer (Pending only) |
| POST | `/api/bookings/:id/extend` | Request extend time | Agent |
| PUT | `/api/bookings/:id/extend/approve` | Approve extension | Officer |

### Master Data

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/ships` | List ships | All (filtered for Agent) |
| POST | `/api/ships` | Create ship | Admin |
| PUT | `/api/ships/:id` | Update ship | Admin |
| DELETE | `/api/ships/:id` | Delete ship | Admin |
| GET | `/api/agents` | List agents | Admin |
| GET | `/api/officers` | List officers | Admin |

### Notifications & Activity

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/notifications` | Get notifications | All |
| PUT | `/api/notifications/:id/read` | Mark as read | All |
| GET | `/api/activity` | Get activity log | All (filtered by role) |
| GET | `/api/activity/export/pdf` | Export as PDF | Officer/Admin |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `update_berthing` | Server → Client | Booking state change broadcast |
| `new_notification` | Server → Client | New notification for user |
| `booking_conflict` | Server → Client | Conflict detected |
| `authenticate` | Client → Server | Send JWT on connection |

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `5000` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `DB_HOST` | Database host | `localhost` | Yes |
| `DB_PORT` | Database port | `5432` | No |
| `DB_NAME` | Database name | `dock_prebooking` | Yes |
| `DB_USER` | Database user | - | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_REFRESH_SECRET` | Refresh token secret | - | Yes |
| `JWT_EXPIRES_IN` | Access token expiry | `15m` | No |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` | No |
| `RECAPTCHA_SECRET_KEY` | Google reCAPTCHA secret | - | Yes (production) |
| `CLIENT_URL` | Client origin for CORS | `http://localhost:5173` | No |
| `VITE_API_URL` | API base URL (client) | `http://localhost:5000/api` | Yes |
| `VITE_SOCKET_URL` | Socket.io URL (client) | `http://localhost:5000` | Yes |
| `VITE_RECAPTCHA_SITE_KEY` | reCAPTCHA site key (client) | - | Yes (production) |

## User Roles

| Role | Description |
|------|-------------|
| **Agen Kapal** | Ship agents who submit pre-booking requests |
| **Petugas Operasional** | Officers who validate and approve/reject bookings |
| **Admin** | System administrators with full access |

## License

Private - All rights reserved.
