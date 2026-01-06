require('dotenv').config();

const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');
const { requestContext } = require('./middleware/requestContext');
const { errorHandler } = require('./middleware/errorHandler');

// Initialize express app
const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedMethods = (process.env.ALLOWED_METHODS || 'GET,POST,PUT,DELETE,PATCH,OPTIONS')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedHeaders = (process.env.ALLOWED_HEADERS || 'Content-Type,Authorization')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (no Origin header) and allow configured origins
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: allowedMethods,
    allowedHeaders,
    credentials: true,
    maxAge: Number(process.env.CORS_MAX_AGE || 3600),
  })
);

app.set('trust proxy', String(process.env.TRUST_PROXY || 'true') === 'true');

// Basic request context
app.use(requestContext);

// Parse JSON request body
app.use(express.json());

// Swagger UI
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  const host = req.get('host'); // may or may not include port
  let protocol = req.protocol; // http or https

  const actualPort = req.socket.localPort;
  const hasPort = host.includes(':');

  const needsPort =
    !hasPort &&
    ((protocol === 'http' && actualPort !== 80) || (protocol === 'https' && actualPort !== 443));
  const fullHost = needsPort ? `${host}:${actualPort}` : host;
  protocol = req.secure ? 'https' : protocol;

  const dynamicSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: `${protocol}://${fullHost}`,
        description: 'Detected server URL',
      },
    ],
  };
  swaggerUi.setup(dynamicSpec)(req, res, next);
});

// Mount routes
app.use('/', routes);

// Error handling middleware (must be last)
app.use(errorHandler);

module.exports = app;
