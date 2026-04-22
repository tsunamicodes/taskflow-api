const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');
const errorMiddleware = require('./middleware/error.middleware');

const app = express();

// Core middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Swagger / OpenAPI
// ---------------------------------------------------------------------------
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TaskFlow API',
      version: '1.0.0',
      description: 'REST API for task management with JWT auth and role-based access.',
    },
    servers: [
      { url: '/api/v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: {
              type: 'array',
              nullable: true,
              items: { type: 'object' },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  // Absolute path so spec parsing works regardless of the launch cwd.
  apis: [path.join(__dirname, 'routes', '*.js')],
});

app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Machine-readable spec for tooling (curl, Postman import, etc.)
app.get('/api/v1/docs.json', (_req, res) => res.json(swaggerSpec));

// Health check
app.get('/health', (_req, res) => res.json({ success: true, message: 'ok', errors: null }));

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/tasks', taskRoutes);

// 404 handler (uses the uniform response shape)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errors: null,
  });
});

// Centralized error handler (must be last)
app.use(errorMiddleware);

module.exports = app;
