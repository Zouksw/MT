import swaggerJsdoc from 'swagger-jsdoc';
import type { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IoTDB Enhanced API',
      version: '1.0.0',
      description:
        'IoTDB Enhanced is a time-series data analytics and AI forecasting platform built on Apache IoTDB. ' +
        'This API provides endpoints for authentication, dataset management, time series operations, ' +
        'AI-powered forecasting and anomaly detection, alert management, and more.',
      contact: {
        name: 'IoTDB Enhanced Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:8000',
        description: 'Development server',
      },
      {
        url: 'https://api.iotdb-enhanced.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the format: Bearer <token>',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'object' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User registration, login, logout, and token management' },
      { name: 'Datasets', description: 'Dataset CRUD operations and data import' },
      { name: 'Time Series', description: 'Time series data querying and management' },
      { name: 'Models', description: 'AI forecasting model training, prediction, and management' },
      { name: 'Anomalies', description: 'Anomaly detection and management' },
      { name: 'Alerts', description: 'Alert and alert rule management' },
      { name: 'API Keys', description: 'API key creation and management' },
      { name: 'IoTDB', description: 'Direct Apache IoTDB operations and AI services' },
      { name: 'Security', description: 'Security audit logs and event tracking' },
      { name: 'Health', description: 'System health, readiness, and liveness checks' },
    ],
  },
  apis: [
    './src/routes/**/*.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
