# MT

Enterprise-grade time series database platform with AI-powered forecasting and real-time analytics.

**Version**: 1.3.0 | **Status**: Production Ready | **Tests**: 1369 passing (70.22% coverage)

---

## Overview

MT extends Apache IoTDB 2.0.5 with AI capabilities, providing a complete solution for time series data management, prediction, and anomaly detection.

**Core Features**:
- High-performance time series data storage and querying
- AI-powered forecasting (ARIMA, LSTM, Transformer, Holt-Winters)
- Real-time anomaly detection with configurable algorithms
- Modern web interface with responsive design
- Enterprise security (JWT, CSRF, rate limiting, encryption)
- Comprehensive monitoring and alerting

**Tech Stack**: Node.js 18, Express, TypeScript 5.8, PostgreSQL 15, Redis 7, IoTDB 2.0.5, Next.js 14, React 19

---

## Quick Start

### Development Environment

```bash
# Clone repository
git clone https://github.com/Zouksw/iotdb-enhanced.git
cd iotdb-enhanced

# Install dependencies
pnpm install

# Start all services
./start.sh    # Start backend, frontend, and databases
./check.sh    # Verify status
./stop.sh     # Stop services
```

### Production Deployment (Systemd)

```bash
# Install dependencies
sudo apt install -y postgresql redis-server nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit environment files with your configuration

# Start all services
./start.sh

# Check status
pm2 status
```

---

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Web management interface |
| Backend API | http://localhost:8000 | RESTful API |
| API Docs | http://localhost:8000/api-docs | Swagger documentation |
| Prometheus | http://localhost:9090 | Metrics monitoring |
| Grafana | http://localhost:3001 | Monitoring dashboards |

---

## Project Structure

```
iotdb-enhanced/
├── backend/              # Express API server
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   ├── middleware/  # Express middleware
│   │   └── lib/         # Utilities
│   ├── prisma/          # Database schema
│   └── config/          # Configuration
├── frontend/            # Next.js web app
│   ├── src/
│   │   ├── app/        # App Router pages
│   │   ├── components/ # React components
│   │   └── lib/        # Utilities
│   └── public/         # Static assets
├── scripts/             # Operations scripts
├── docs/                # Documentation
└── ecosystem.config.cjs # PM2 configuration
```

---

## Features

### Data Management
- Multi-dataset support with flexible schemas
- Real-time data ingestion and querying
- Time series data visualization
- Export to CSV, JSON, and Excel
- Bulk import from CSV and JSON

### AI/ML Capabilities
- **Forecasting Models**: ARIMA, Prophet, LSTM, Transformer, Holt-Winters
- **Automated Training**: Model selection and hyperparameter tuning
- **Anomaly Detection**: Statistical and ML-based methods
- **Confidence Intervals**: Prediction uncertainty quantification
- **Model Management**: Version control and performance tracking

### Security
- JWT-based authentication with HttpOnly cookies
- CSRF protection on all state-changing operations
- Rate limiting with Redis backend
- Input validation and sanitization
- SQL injection prevention
- Role-based access control (RBAC)
- Comprehensive audit logging

### Monitoring
- Real-time alert rules with multiple conditions
- Alert notifications via email and webhooks
- Prometheus metrics integration
- Grafana dashboards
- Performance tracking
- Health check endpoints

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/INDEX.md](docs/INDEX.md) | Documentation index |
| [docs/API.md](docs/API.md) | Complete API reference |
| [docs/SECURITY.md](docs/SECURITY.md) | Security policies |
| [docs/DESIGN.md](docs/DESIGN.md) | System architecture |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Development roadmap |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Version history |

---

## AI Capabilities

**Security**: AI functions use process isolation, admin-only access, and audit logging.

**Available Models**:
- ARIMA - AutoRegressive Integrated Moving Average
- LSTM - Long Short-Term Memory networks
- Transformer - Attention-based sequence modeling
- Prophet - Facebook's forecasting algorithm
- Holt-Winters - Triple exponential smoothing

**API Endpoints**:
```bash
# List available models
GET /api/iotdb/ai/models

# Time series prediction
POST /api/iotdb/ai/predict
{
  "timeseries": "root.sg.device1.temperature",
  "horizon": 10,
  "algorithm": "arima"
}

# Anomaly detection
POST /api/iotdb/ai/anomalies
{
  "timeseries": "root.sg.device1.temperature",
  "method": "statistical"
}
```

---

## Environment Variables

**Backend** (`backend/.env`):
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/iotdb_enhanced

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=1h

# IoTDB
IOTDB_HOST=localhost
IOTDB_PORT=6667
IOTDB_USERNAME=root
IOTDB_PASSWORD=root
IOTDB_AI_ENABLED=false

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Management Commands

### Service Management

```bash
./start.sh    # Start all services (backend, frontend)
./stop.sh     # Stop all services
./check.sh    # Check service status
```

### Database Operations

```bash
./scripts/auto-backup.sh       # Automated backup
./scripts/health-check.sh      # Health verification
```

### User Management

```bash
./scripts/user-management.sh create-admin     # Create admin user
./scripts/user-management.sh change-password  # Reset password
```

---

## Testing

```bash
cd backend

npm test              # Run all tests
npm run test:coverage # Generate coverage report
npm run test:watch    # Watch mode
```

**Current Status**: 1369 tests passing, 70.22% coverage

---

## Deployment

See [Deployment Guide](docs/deployment/) for:
- Server requirements
- Environment configuration
- SSL/TLS setup
- Performance optimization
- Monitoring setup

---

## Security Features

- **Authentication**: JWT with HttpOnly cookies
- **CSRF Protection**: Double-submit cookie pattern
- **SQL Injection Prevention**: Input validation and escaping
- **Rate Limiting**: Redis-backed (100 req/15min per IP)
- **Security Headers**: Helmet.js configuration
- **AI Isolation**: Process isolation with resource limits
- **Audit Logging**: All sensitive operations logged

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/guides/CONTRIBUTING.md) for guidelines.

---

## License

Apache License 2.0

---

## Links

- **GitHub**: https://github.com/Zouksw/iotdb-enhanced
- **Apache IoTDB**: https://iotdb.apache.org/
- **Documentation**: [docs/](docs/)
- **Issues**: https://github.com/Zouksw/iotdb-enhanced/issues

---

**MT** - Enterprise Time Series Data Platform © 2025
