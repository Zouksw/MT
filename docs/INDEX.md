# MT - Documentation

**Version**: 1.3.0 | **Last Updated**: 2026-03-28

---

## Quick Navigation

### Getting Started
- [README](../README.md) - Project overview and quick start guide
- [API Reference](API.md) - Complete REST API documentation
- [Deployment Guide](deployment/) - Production deployment instructions

### Core Documentation
- [Security](SECURITY.md) - Security policies and best practices
- [Design System](DESIGN.md) - Architecture and design decisions
- [Roadmap](ROADMAP.md) - Development roadmap

### Developer Resources
- [Contributing](guides/CONTRIBUTING.md) - Contribution guidelines
- [Claude Instructions](developer/CLAUDE.md) - AI assistant guidelines
- [Secrets Management](guides/SECRETS-MANAGEMENT.md) - Credentials handling

---

## By Topic

### Authentication & Security
- [SECURITY.md](SECURITY.md) - Complete security guide
  - JWT authentication
  - CSRF protection
  - Rate limiting
  - Input validation

### API & Integration
- [API.md](API.md) - REST API reference
  - Authentication endpoints
  - Time series CRUD
  - AI/ML endpoints
  - Alert management

### Deployment & Operations
- [Deployment Checklist](deployment/DEPLOYMENT-CHECKLIST.md) - Pre-deployment verification
- [AI Node Setup](ai-node-setup.md) - AI features configuration

### Development
- [Design System](DESIGN.md) - System architecture
- [Contributing](guides/CONTRIBUTING.md) - Development workflow

---

## Document Index

| Document | Description | Audience |
|----------|-------------|----------|
| [API.md](API.md) | REST API endpoints and schemas | Developers |
| [SECURITY.md](SECURITY.md) | Security configuration | Operators, Developers |
| [DESIGN.md](DESIGN.md) | Architecture and design | Developers |
| [ROADMAP.md](ROADMAP.md) | Future development | All |
| [ai-node-setup.md](ai-node-setup.md) | AI Node deployment | Operators |
| [CHANGELOG.md](CHANGELOG.md) | Version history | All |

---

## Quick Links

### Common Tasks

**Start Development**:
```bash
./start.sh    # Start all services
./check.sh    # Verify status
```

**Run Tests**:
```bash
cd backend && npm test
```

**Deploy**:
```bash
# See deployment/DEPLOYMENT-CHECKLIST.md
```

---

## Document Standards

### Format
- Markdown with YAML metadata
- Clear section headers
- Code examples with syntax highlighting
- Links to related documents

### Maintenance
- Update `lastUpdated` field on changes
- Review quarterly
- Archive outdated documents

---

**Maintainer**: MT Team
**Last Review**: 2026-03-28
**Next Review**: 2026-06-28
