// src/api/swagger.js
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger').child({ module: 'swagger' });

// Настройки Swagger UI
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AI Admin v2 API Documentation',
  customfavIcon: '/favicon.ico'
};

// Middleware для Swagger UI
const setupSwagger = (app) => {
  try {
    const openapiPath = path.join(__dirname, '../../openapi.yaml');

    // Check if openapi.yaml exists
    if (!fs.existsSync(openapiPath)) {
      logger.warn('⚠️  OpenAPI spec not found at openapi.yaml - Swagger UI disabled');

      // Serve placeholder endpoints
      app.get('/api-docs', (req, res) => {
        res.status(503).send('<h1>API Documentation Not Available</h1><p>openapi.yaml file is missing.</p>');
      });

      app.get('/openapi.yaml', (req, res) => {
        res.status(404).json({ error: 'OpenAPI spec not found' });
      });

      app.get('/openapi.json', (req, res) => {
        res.status(404).json({ error: 'OpenAPI spec not found' });
      });

      return;
    }

    // Load OpenAPI spec
    const openapiDocument = YAML.load(openapiPath);

    // Serve Swagger UI на /api-docs
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, swaggerOptions));

    // Serve raw OpenAPI spec
    app.get('/openapi.yaml', (req, res) => {
      res.sendFile(openapiPath);
    });

    app.get('/openapi.json', (req, res) => {
      res.json(openapiDocument);
    });

    logger.info('✅ Swagger UI enabled at /api-docs');

  } catch (error) {
    logger.error('Failed to setup Swagger:', error);

    // Don't crash the server - just disable Swagger
    app.get('/api-docs', (req, res) => {
      res.status(503).send('<h1>API Documentation Error</h1><p>Failed to load OpenAPI spec.</p>');
    });
  }
};

module.exports = { setupSwagger };