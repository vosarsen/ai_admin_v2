// src/api/swagger.js
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// Загружаем OpenAPI спецификацию
const openapiDocument = YAML.load(path.join(__dirname, '../../openapi.yaml'));

// Настройки Swagger UI
const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'AI Admin v2 API Documentation',
  customfavIcon: '/favicon.ico'
};

// Middleware для Swagger UI
const setupSwagger = (app) => {
  // Serve Swagger UI на /api-docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, swaggerOptions));
  
  // Serve raw OpenAPI spec
  app.get('/openapi.yaml', (req, res) => {
    res.sendFile(path.join(__dirname, '../../openapi.yaml'));
  });
  
  app.get('/openapi.json', (req, res) => {
    res.json(openapiDocument);
  });
};

module.exports = { setupSwagger };