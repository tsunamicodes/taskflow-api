# TaskFlow API

A production-style REST API for task management. TaskFlow provides user registration and authentication, role-based access control, and CRUD endpoints for tasks owned by each user. Administrators can see and mutate every task; regular users are scoped to their own. Requests are validated with Zod, persisted through Prisma, and documented with an OpenAPI 3 spec served by Swagger UI.

The codebase is designed to be a clean, scalable starting point: centralized error handling with a uniform response envelope, pluggable validation middleware, and a folder structure that separates routes, controllers, middleware, and validators so each layer stays small and testable.

## Tech stack

| Layer            | Library / Tool                          | Purpose                                   |
| ---------------- | --------------------------------------- | ----------------------------------------- |
| Runtime          | Node.js 18+                             | JavaScript runtime                        |
| Web framework    | Express 4                               | HTTP routing and middleware               |
| ORM              | Prisma 5 (`@prisma/client`, `prisma`)   | Type-safe DB access, migrations           |
| Database         | PostgreSQL (configurable via Prisma)    | Primary datastore                         |
| Auth             | `jsonwebtoken`, `bcryptjs`              | JWT signing / verification, password hash |
| Validation       | `zod`                                   | Runtime schema validation                 |
| API docs         | `swagger-jsdoc`, `swagger-ui-express`   | OpenAPI 3 spec + interactive UI           |
| Cross-origin     | `cors`                                  | CORS policy middleware                    |
| Config           | `dotenv`                                | Load `.env` into `process.env`            |

## Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url> taskflow-api
   cd taskflow-api
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # then edit .env and fill in DATABASE_URL and JWT_SECRET
   ```
   Required keys: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`.
4. **Run Prisma migrations** (creates the schema on your database)
   ```bash
   npm run prisma:migrate
   ```
   This runs `prisma migrate dev` against `src/prisma/schema.prisma`, generating the Prisma client and applying migrations under `src/prisma/migrations/`.
5. **Start the dev server**
   ```bash
   npm run dev
   ```
   The server prints its URL (default `http://localhost:3000`). Swagger UI is available at `GET /api/v1/docs`, and the raw spec at `GET /api/v1/docs.json`.

## API endpoints

All endpoints live under the `/api/v1` prefix. Authenticated routes require an `Authorization: Bearer <jwt>` header obtained from `POST /auth/login`.

| Method | Path                  | Auth required           | Description                                                        |
| ------ | --------------------- | ----------------------- | ------------------------------------------------------------------ |
| POST   | `/auth/register`      | No                      | Register a new user; returns the user record and a JWT.            |
| POST   | `/auth/login`         | No                      | Authenticate with email + password; returns the user and a JWT.    |
| GET    | `/tasks`              | Yes                     | List tasks. `ADMIN` sees every task; `USER` sees only their own.   |
| POST   | `/tasks`              | Yes                     | Create a task owned by the current user.                           |
| PATCH  | `/tasks/:id`          | Yes (owner or ADMIN)    | Partial update of a task's `title`, `description`, or `status`.    |
| DELETE | `/tasks/:id`          | Yes (owner or ADMIN)    | Delete a task.                                                     |
| GET    | `/docs`               | No                      | Interactive Swagger UI.                                            |
| GET    | `/docs.json`          | No                      | Raw OpenAPI 3 spec (JSON).                                         |
| GET    | `/health` *(no prefix)* | No                    | Liveness probe; returns `{ success: true, message: "ok" }`.        |

Every error response uses a uniform envelope:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "path": "email", "message": "Invalid email", "code": "invalid_string" }
  ]
}
```

`errors` is populated with field-level details for validation failures and is `null` otherwise.

## Database schema

The schema lives at `src/prisma/schema.prisma` and defines two models plus two enums.

```
┌──────────────────────────────┐           ┌──────────────────────────────┐
│ User                         │           │ Task                         │
├──────────────────────────────┤  1     N  ├──────────────────────────────┤
│ id            String   PK    │───────────│ userId        String   FK    │
│ email         String   UQ    │           │ id            String   PK    │
│ passwordHash  String         │           │ title         String         │
│ role          Role   (enum)  │           │ description   String?        │
│ createdAt     DateTime       │           │ status        TaskStatus     │
└──────────────────────────────┘           │ createdAt     DateTime       │
                                           │ updatedAt     DateTime       │
                                           └──────────────────────────────┘

Role enum          TaskStatus enum
─────────────      ─────────────────
USER               TODO
ADMIN              IN_PROGRESS
                   DONE

Relations
─────────
User 1 ──< Task   (Task.userId references User.id, ON DELETE CASCADE)
Indexes: Task.userId (secondary index), User.email (unique)
```

Notes on the design:

- **IDs** are `cuid()` strings. This keeps primary keys URL-safe and avoids exposing sequential IDs, which is useful for public-facing URLs.
- **Cascade delete** on `Task.userId` ensures that removing a user cleans up their tasks, avoiding orphan rows.
- **Index on `Task.userId`** keeps the common "list tasks for user X" query fast as task volume grows.

## Scalability notes

The current single-process, single-database layout is appropriate for early traffic. As usage grows, the following steps let the service scale horizontally without rewriting the core domain.

### Horizontal scaling behind a load balancer

The API is stateless: all request-scoped data lives in the JWT or the database, and no session is stored in process memory. That means it is safe to run an arbitrary number of Node instances behind a load balancer (e.g. AWS ALB, GCP HTTPS LB, or an nginx/HAProxy fronting a pool). A typical production topology looks like:

```
        ┌─────────────────┐
        │   Load Balancer │  (TLS termination, health checks)
        └────────┬────────┘
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
  [api-1]    [api-2]    [api-N]        ← stateless Node instances
     │           │           │
     └───────────┼───────────┘
                 ▼
           [PostgreSQL]                 ← primary + replicas
```

Health checks should target `GET /health`. Instances can be autoscaled on CPU or request-rate metrics. To keep the database from becoming a bottleneck, add read replicas and route read-heavy traffic (for example `GET /tasks`) to a replica-aware connection pool; Prisma supports this via its read-replica extension.

### Redis caching for `GET /tasks`

Task lists are read-heavy and often repeated within a short window (a user refreshing the dashboard, a frontend re-fetching after a tab focus, etc.). Caching the serialized response in Redis dramatically reduces database load.

A practical cache strategy:

- **Key** — `tasks:{userId}` for user-scoped reads, `tasks:all` for the admin view.
- **Value** — the JSON response body.
- **TTL** — short (30–120 s). Short TTLs make mistakes recoverable without active invalidation.
- **Invalidation** — on `POST`, `PATCH`, and `DELETE` in the task controller, `DEL` the owner's key (and `tasks:all`).
- **Stampede protection** — use a `SET NX EX` lock around the refill so a cache miss under load produces a single database query, not one per request.

This fits neatly behind the existing controller layer: wrap `prisma.task.findMany` in a `cachedListTasks(userId)` helper without changing the route surface.

### Splitting into microservices

The code is already partitioned along a clean seam — authentication and task management do not share state beyond a user ID. When the team or the traffic shape justifies the operational overhead, the monolith can be split in two:

- **`auth-service`** owns users, password hashing, and JWT issuance. It exposes `POST /auth/register`, `POST /auth/login`, and any future account/profile endpoints. It is the only service that writes to the `User` table.
- **`task-service`** owns tasks. It exposes the CRUD endpoints and treats JWTs as opaque bearer credentials it verifies with a shared secret or the auth service's public key (if you move to asymmetric signing with RS256/JWKS). It owns the `Task` table.

An API gateway (Kong, Envoy, or a thin Node/BFF layer) routes `/api/v1/auth/*` to `auth-service` and `/api/v1/tasks/*` to `task-service`. Services communicate only through JWT claims — no cross-service database access — which keeps the blast radius of a deploy small and makes each service independently deployable.

### Docker + docker-compose

Packaging the API as a container is the fastest way to get predictable deploys across dev, staging, and production. A minimal setup looks like this.

**`Dockerfile`** (multi-stage, produces a small runtime image):

```Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate --schema=src/prisma/schema.prisma

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app ./
EXPOSE 3000
CMD ["node", "src/server.js"]
```

**`docker-compose.yml`** (API + Postgres + Redis for local development):

```yaml
version: "3.9"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: taskflow
      POSTGRES_PASSWORD: taskflow
      POSTGRES_DB: taskflow
    ports: ["5432:5432"]
    volumes: ["db-data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U taskflow"]
      interval: 5s

  cache:
    image: redis:7-alpine
    ports: ["6379:6379"]

  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://taskflow:taskflow@db:5432/taskflow?schema=public
      JWT_SECRET: change_me_in_production
      PORT: "3000"
      NODE_ENV: production
    ports: ["3000:3000"]
    command: sh -c "npx prisma migrate deploy --schema=src/prisma/schema.prisma && node src/server.js"

volumes:
  db-data:
```

With those two files in place, `docker compose up --build` brings up Postgres, Redis, and the API locally, and the same image is what you push to production. In Kubernetes, the same image runs behind a `Deployment` with a `HorizontalPodAutoscaler`, a managed Postgres and Redis replace the compose services, and the load-balancer topology above slots in without code changes.
