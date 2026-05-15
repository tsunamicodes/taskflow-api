# TaskFlow API

A task management REST API I built to practice backend development — auth, role-based access, validation, and clean API design.

## What it does

Users can register, log in, and manage their own tasks. Admins can see and manage everyone's tasks. Each task has a title, description, status, and priority level.

## Tech stack

- **Node.js + Express** — HTTP server and routing
- **PostgreSQL** — database
- **Prisma** — ORM for database access and migrations
- **JWT + bcryptjs** — authentication and password hashing
- **Zod** — request validation
- **Swagger UI** — API documentation

## Getting started

**1. Clone and install**
```bash
git clone https://github.com/tsunamicodes/taskflow-api.git
cd taskflow-api
npm install
```

**2. Set up environment variables**
```bash
cp .env.example .env
```

Open `.env` and fill in:
```
DATABASE_URL="your-postgres-connection-string"
JWT_SECRET=your_secret_key
PORT=3000
NODE_ENV=development
```

**3. Run database migrations**
```bash
npm run prisma:generate
npm run prisma:migrate
```

**4. Start the server**
```bash
npm run dev
```

Server runs at `http://localhost:3000`
Swagger docs at `http://localhost:3000/api/v1/docs`

## API endpoints

All routes are prefixed with `/api/v1`. Protected routes require `Authorization: Bearer <token>` header.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register a new user |
| POST | `/auth/login` | No | Login and get JWT |
| GET | `/tasks` | Yes | Get tasks (admin sees all, user sees own) |
| POST | `/tasks` | Yes | Create a task |
| PATCH | `/tasks/:id` | Yes | Update a task (owner or admin only) |
| DELETE | `/tasks/:id` | Yes | Delete a task (owner or admin only) |
| GET | `/health` | No | Health check |

## Database schema

**User**
- `id` — unique identifier (cuid)
- `email` — unique
- `passwordHash` — bcrypt hashed
- `role` — USER or ADMIN
- `createdAt`

**Task**
- `id` — unique identifier (cuid)
- `title` — required
- `description` — optional
- `status` — TODO, IN_PROGRESS, or DONE
- `priority` — LOW, MEDIUM, or HIGH
- `userId` — references User
- `createdAt`, `updatedAt`

## What I learned

- How JWT authentication actually works end to end — signing tokens, verifying them in middleware, and attaching user context to requests
- Setting up role-based access control in a clean way using middleware factories
- Using Prisma for schema design and migrations — really liked how it handles type safety
- Structuring an Express project so it doesn't turn into a mess as it grows (routes → controllers → validators → middleware)
- Writing Zod schemas for validation and surfacing field-level errors back to the client in a consistent format
