# IoTDB AI Node Setup Guide

## Overview

The TradeMind AI platform integrates Apache IoTDB 2.0.5 AI Node, providing advanced time-series forecasting, anomaly detection, and machine learning capabilities.

## Installation Status

✅ **AI Node Installed**: `/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/`
✅ **Python Environment**: Virtual environment at `/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/venv/`
✅ **Service Status**: Running on port 10810

## Quick Start

### Start All Services
```bash
./start.sh
```

This will start:
1. IoTDB DataNode (port 6667)
2. IoTDB ConfigNode (port 10710)
3. AI Node (port 10810)
4. PostgreSQL (port 5432)
5. Redis (port 6379)
6. Backend API (port 8000)
7. Frontend (port 3000)

### Stop All Services
```bash
./stop.sh
```

### Check Service Status
```bash
./check.sh
```

## AI Node Management

### Individual AI Node Control

**Start AI Node only:**
```bash
./scripts/start-ainode.sh
```

**Stop AI Node only:**
```bash
./scripts/stop-ainode.sh
```

### PM2 Management (Optional)

**Start AI Node with PM2:**
```bash
pm2 start ecosystem.config.cjs --only iotdb-ainode
```

**Stop AI Node:**
```bash
pm2 stop iotdb-ainode
```

**View AI Node logs:**
```bash
pm2 logs iotdb-ainode
```

## Available AI Models

### Prediction Models

| Model | Description | Use Case |
|-------|-------------|----------|
| **ARIMA** | AutoRegressive Integrated Moving Average | Short-term forecasting, seasonal data |
| **Timer_XL** | Long Short-Term Memory Network | Complex patterns, long-term dependencies |
| **Sundial** | Transformer-based model | Complex temporal patterns |
| **Holt-Winters** | Triple exponential smoothing | Trend and seasonality data |
| **Exponential Smoothing** | Simple exponential smoothing | Short-term forecasting, no trend |
| **Naive Forecaster** | Naive prediction method | Baseline forecasting |
| **STL Forecaster** | STL decomposition forecasting | Complex seasonal patterns |

### Anomaly Detection Methods

| Method | Description |
|--------|-------------|
| **STRAY** | STRAY algorithm anomaly detection |
| **Statistical** | Z-score statistical method |
| **ML** | Machine learning-based detection |

## API Endpoints

### Prediction

**Single Time Series Prediction:**
```bash
curl -X POST http://localhost:8000/api/iotdb/ai/predict \
  -H "Content-Type: application/json" \
  -d '{
    "timeseries": "root.sg.device1.temperature",
    "horizon": 10,
    "algorithm": "arima"
  }'
```

**Batch Prediction:**
```bash
curl -X POST http://localhost:8000/api/iotdb/ai/predict/batch \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"timeseries": "root.sg1.temp", "horizon": 10, "algorithm": "arima"},
      {"timeseries": "root.sg1.humidity", "horizon": 5, "algorithm": "holtwinters"}
    ]
  }'
```

### Anomaly Detection

```bash
curl -X POST http://localhost:8000/api/iotdb/ai/anomalies \
  -H "Content-Type: application/json" \
  -d '{
    "timeseries": "root.sg.device1.temperature",
    "method": "statistical"
  }'
```

### Model Management

**List Available Models:**
```bash
curl http://localhost:8000/api/iotdb/ai/models
```

**Train Custom Model:**
```bash
curl -X POST http://localhost:8000/api/iotdb/ai/models/train \
  -H "Content-Type: application/json" \
  -d '{
    "timeseries": "root.sg.device1.temperature",
    "algorithm": "arima",
    "parameters": {"p": 1, "d": 1, "q": 1}
  }'
```

## Configuration

### Backend Environment Variables

Edit `/root/backend/.env`:

```bash
# AI Feature Flags
AI_FEATURES_DISABLED=false        # Enable AI features
IOTDB_AI_ENABLED=true             # Enable IoTDB AI integration

# AI Node Connection
AI_NODE_HOME=/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin
AI_NODE_HOST=127.0.0.1
AI_NODE_PORT=10810

# Python Environment
PYTHON_PATH=/opt/iotdb-ainode/apache-iotdb-2.0.5-all-bin/venv/bin/python3

# AI Execution Limits
AI_TIMEOUT=120000                 # 120 seconds
AI_MAX_MEMORY=512M                # 512 MB
AI_MAX_CPU_TIME=60                # 60 seconds
AI_ISOLATION_MODE=process         # Process isolation
```

### AI Node Configuration

**Environment Configuration:**
`/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/conf/ainode-env.sh`

**Properties Configuration:**
`/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/conf/ainode.properties`

## Troubleshooting

### AI Node Won't Start

**1. Check ConfigNode is running:**
```bash
nc -z localhost 10710 && echo "ConfigNode OK" || echo "ConfigNode not running"
```

**2. Check for data directory conflicts:**
```bash
# Remove old AI Node data if needed
rm -rf /opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/data/ainode
```

**3. Check AI Node logs:**
```bash
tail -50 /opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/logs/log_ainode_error.log
```

### Port Already in Use

```bash
# Find process using port 10810
lsof -i :10810

# Kill the process
kill -9 <PID>
```

### Model Weights Download Failed

Some AI models (Timer_XL, Sundial) require downloading weights from HuggingFace. If download fails:

1. **Check internet connection**
2. **Use alternative models** (ARIMA, Holt-Winters work offline)
3. **Manually download weights** to:
   ```
   /opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/data/ainode/models/weights/
   ```

### API Returns Errors

**1. Verify AI Node is running:**
```bash
curl http://localhost:8000/api/iotdb/ai/models
```

**2. Check backend configuration:**
```bash
grep AI_ /root/backend/.env
```

**3. Test AI Node directly:**
```bash
nc -z localhost 10810 && echo "AI Node reachable"
```

## Monitoring

### Log Locations

| Service | Log Path |
|---------|----------|
| AI Node Info | `/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/logs/log_ainode_info.log` |
| AI Node Error | `/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/logs/log_ainode_error.log` |
| AI Node All | `/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/logs/log_ainode_all.log` |
| Backend AI Service | `/root/logs/backend-combined.log` |

### Health Check

```bash
# Check AI Node port
nc -z localhost 10810 && echo "AI Node OK"

# Check AI Node process
ps aux | grep ainode

# Check backend health
curl http://localhost:8000/health

# Check AI models availability
curl http://localhost:8000/api/iotdb/ai/models
```

## Performance Tuning

### Memory Configuration

**For large datasets:**
```bash
# Increase AI Node memory limit
AI_MAX_MEMORY=2G  # in backend/.env
```

**For faster predictions:**
```bash
# Reduce timeout for quick failures
AI_TIMEOUT=30000  # 30 seconds
```

### Concurrent Requests

The backend supports concurrent AI requests. Configure in `backend/.env`:

```bash
# AI Service Pool
AI_MAX_CONCURRENT=5  # Max parallel AI requests
```

## Security

### AI Isolation

AI features run in isolated processes with:
- **CPU time limits**: 60 seconds per request
- **Memory limits**: 512 MB per request
- **Process isolation**: Separate process per AI request

### Access Control

AI endpoints require:
- **Authentication**: Valid JWT token
- **Authorization**: Admin role (configurable)
- **Rate limiting**: 100 requests per 15 minutes

## Advanced Usage

### Custom Model Training

```bash
curl -X POST http://localhost:8000/api/iotdb/ai/models/train \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "timeseries": "root.sg.device1.temperature",
    "algorithm": "arima",
    "parameters": {
      "p": 2,
      "d": 1,
      "q": 2
    },
    "trainingSize": 1000
  }'
```

### Using Trained Models

```bash
curl -X POST http://localhost:8000/api/models/<modelId>/predict \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "horizon": 10
  }'
```

## References

- [IoTDB Documentation](https://iotdb.apache.org/)
- [AI Node Guide](https://iotdb.apache.org/UserGuide/latest/API/AI-Native-Integration.html)
- [Backend API Docs](/api.md)

## Support

For issues or questions:
1. Check logs in `/opt/iotdb-ainode/apache-iotdb-2.0.5-ainode-bin/logs/`
2. Run `./check.sh` for service status
3. Review backend logs: `pm2 logs iotdb-backend`
