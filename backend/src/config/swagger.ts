import swaggerJsdoc from 'swagger-jsdoc';
import type { Options } from 'swagger-jsdoc';

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TradeMind AI API',
      version: '1.0.0',
      description:
        'TradeMind AI is a commodity market intelligence platform providing price data, ' +
        'multi-factor analysis, and AI-powered predictions. This API covers commodity data, ' +
        'AI signal generation, watchlists, analytics, community features, and more.',
      contact: {
        name: 'TradeMind AI Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:8000',
        description: 'Development server',
      },
      {
        url: 'https://api.trademind.example.com',
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
      { name: 'Market Data', description: 'Commodity prices, market factors, and data import' },
      { name: 'Signals', description: 'AI prediction signals and multi-model forecasts' },
      { name: 'Watchlists', description: 'Commodity watchlists and real-time quotes' },
      { name: 'Analytics', description: 'Seasonality, correlation, and trend analysis' },
      { name: 'Community', description: 'Signal sharing, leaderboard, and social features' },
      { name: 'Backtest', description: 'Prediction accuracy verification against historical data' },
      { name: 'Analysis Groups', description: 'Commodity grouping for comparative analysis' },
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
