---
title: "MT API Reference"
version: "1.3.0"
last_updated: "2026-03-28"
status: "stable"
maintainer: "MT Team"
tags:
  - "api"
  - "rest"
  - "reference"
target_audience: "Developers, Integration Engineers"
next_review: "2026-06-28"
---

# MT API Reference

Complete RESTful API documentation for MT platform.

---

## Quick Info

| Property | Value |
|----------|-------|
| Base URL (dev) | `http://localhost:8000` |
| Base URL (prod) | `https://your-domain.com/api` |
| Data Format | JSON |
| Encoding | UTF-8 |
| Interactive Docs | http://localhost:8000/api-docs |

---

## Authentication

All API endpoints (except auth endpoints) require authentication:

### JWT Token Authentication

```bash
# Include token in Authorization header
Authorization: Bearer <your-jwt-token>

# Or use HttpOnly cookie (automatically set by login)
```

### Get Authentication Token

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password",
  "remember": true
}

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

## Core Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new user account |
| `/api/auth/login` | POST | Login with email/password |
| `/api/auth/logout` | POST | Logout and invalidate token |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/verify` | GET | Verify authentication status |
| `/api/auth/me` | GET | Get current user info |
| `/api/auth/change-password` | PUT | Change password |
| `/api/auth/csrf-token` | GET | Get CSRF token |

### Time Series Data

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/timeseries` | GET | List all time series |
| `/api/timeseries` | POST | Create new time series |
| `/api/timeseries/:id` | GET | Get time series details |
| `/api/timeseries/:id` | PATCH | Update time series |
| `/api/timeseries/:id` | DELETE | Delete time series |
| `/api/timeseries/:id/data` | POST | Insert data points |
| `/api/timeseries/:id/data` | GET | Query data points |

### Datasets

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/datasets` | GET | List all datasets |
| `/api/datasets` | POST | Create dataset |
| `/api/datasets/:id` | GET | Get dataset details |
| `/api/datasets/:id` | PATCH | Update dataset |
| `/api/datasets/:id` | DELETE | Delete dataset |
| `/api/datasets/:id/export` | GET | Export dataset |
| `/api/datasets/:id/import` | POST | Import data |

### AI/ML Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/models` | GET | List available AI models |
| `/api/ai/predict` | POST | Generate forecast |
| `/api/ai/anomalies` | POST | Detect anomalies |
| `/api/forecasts` | GET | List forecasts |
| `/api/forecasts` | POST | Create forecast |
| `/api/forecasts/:id` | GET | Get forecast results |
| `/api/anomalies` | GET | List detected anomalies |
| `/api/anomalies` | POST | Create anomaly detection |

### Alerts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/alerts` | GET | List alerts |
| `/api/alerts/rules` | GET | List alert rules |
| `/api/alerts/rules` | POST | Create alert rule |
| `/api/alerts/rules/:id` | PATCH | Update alert rule |
| `/api/alerts/rules/:id` | DELETE | Delete alert rule |
| `/api/alerts/:id/read` | PATCH | Mark alert as read |

### API Keys

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/apikeys` | GET | List API keys |
| `/api/apikeys` | POST | Create API key |
| `/api/apikeys/:id` | DELETE | Delete API key |

### System Monitoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check |
| `/api/ready` | GET | Readiness probe |
| `/api/live` | GET | Liveness probe |
| `/api/metrics` | GET | Prometheus metrics |
| `/api/cache/stats` | GET | Cache statistics |
| `/api/cache/clear` | POST | Clear cache |

---

## Request/Response Examples

### Create Time Series

```bash
POST /api/timeseries
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "device1_temperature",
  "deviceId": "device1",
  "measurement": "temperature",
  "unit": "celsius",
  "description": "Temperature readings from device 1"
}

# Response
{
  "id": "ts-123",
  "name": "device1_temperature",
  "deviceId": "device1",
  "measurement": "temperature",
  "unit": "celsius",
  "description": "Temperature readings from device 1",
  "createdAt": "2025-03-28T10:00:00Z"
}
```

### Insert Data Points

```bash
POST /api/timeseries/ts-123/data
Content-Type: application/json
Authorization: Bearer <token>

{
  "datapoints": [
    { "timestamp": "2025-03-28T10:00:00Z", "value": 25.5 },
    { "timestamp": "2025-03-28T10:01:00Z", "value": 26.0 },
    { "timestamp": "2025-03-28T10:02:00Z", "value": 26.2 }
  ]
}

# Response
{
  "success": true,
  "inserted": 3,
  "failed": 0
}
```

### Generate Forecast

```bash
POST /api/ai/predict
Content-Type: application/json
Authorization: Bearer <token>

{
  "timeseries": "device1_temperature",
  "horizon": 10,
  "algorithm": "arima",
  "confidenceInterval": 0.95
}

# Response
{
  "forecastId": "fc-123",
  "predictions": [
    { "timestamp": "2025-03-28T10:10:00Z", "value": 26.5, "lower": 25.8, "upper": 27.2 },
    { "timestamp": "2025-03-28T10:11:00Z", "value": 26.7, "lower": 25.9, "upper": 27.5 }
  ],
  "metrics": {
    "mape": 0.05,
    "rmse": 0.3
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation error |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

---

## Rate Limiting

- **Default**: 100 requests per 15 minutes per IP
- **Authenticated**: 1000 requests per 15 minutes per user
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Pagination

List endpoints support pagination:

```bash
GET /api/timeseries?page=1&pageSize=20&sortBy=name&order=asc

# Response
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## SDKs & Libraries

Official SDKs:
- JavaScript/TypeScript: `@mt/sdk` (Coming soon)
- Python: `mt-python` (Coming soon)

---

## Interactive Documentation

For full interactive API documentation with try-it-out functionality:

**Development**: http://localhost:8000/api-docs
**Production**: https://your-domain.com/api-docs

---

## Support

- **Issues**: https://github.com/Zouksw/MT/issues
- **Discussions**: https://github.com/Zouksw/MT/discussions
- **Email**: support@mt.com

---

**Last Updated**: 2026-03-28
**API Version**: 1.3.0
