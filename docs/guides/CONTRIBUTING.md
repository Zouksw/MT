# Contributing to MT

Thank you for your interest in contributing to MT! We welcome contributions from developers of all skill levels.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Reporting Issues](#reporting-issues)

---

## Getting Started

### Prerequisites

- **Node.js**: 20.x or later
- **PostgreSQL**: 15.x
- **Redis**: 7.x
- **Apache IoTDB**: 2.0.8 (optional, for AI features)
- **pnpm**: Latest version (recommended package manager)

### Initial Setup

1. **Fork the repository**
   ```bash
   # Fork the repository on GitHub
   # Then clone your fork
   git clone https://github.com/YOUR-USERNAME/trademind-ai.git
   cd trademind-ai
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Setup environment files**
   ```bash
   # Backend environment
   cp /root/config/backend.env.example /root/backend/.env
   # Edit /root/backend/.env with your configuration

   # Frontend environment
   cp /root/config/frontend.env.example /root/frontend/.env.local
   # Edit /root/frontend/.env.local with your configuration
   ```

4. **Start the development servers**
   ```bash
   ./start.sh
   ```
   This will start:
   - Backend API on http://localhost:8000
   - Frontend web app on http://localhost:3000
   - PostgreSQL, Redis, and IoTDB services

---

## Development Workflow

### Branch Strategy

We use a simplified Git workflow:

- **main**: Production-ready code
- **feature/your-feature-name**: New features
- **fix/your-bug-fix**: Bug fixes
- **docs/your-doc-change**: Documentation updates

### Creating a Branch

```bash
git checkout -b feature/your-feature-name
```

### Making Changes

1. Write code following our [Code Style](#code-style) guidelines
2. Add tests for your changes
3. Ensure all tests pass: `cd backend && npm test`
4. Run linting: `npm run lint`
5. Format code: `npm run format`

### Committing Changes

Our pre-commit hooks will automatically:
- Run ESLint to check code quality
- Run Prettier to format code
- Run tests (optional, can be skipped with `--no-verify`)

If tests fail, the commit will be blocked. You can:
- Fix the issues and try again
- Skip the hook (not recommended): `git commit --no-verify`

---

## Code Style

### Formatting

We use **Prettier** for consistent code formatting:

```bash
# Format all files
npm run format

# Check formatting without making changes
npm run format:check
```

Configuration: [`.prettierrc`](/.prettierrc)

### Linting

We use **ESLint** for code quality checks:

```bash
# Lint all files
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

Configuration: [`backend/.eslintrc.json`](/backend/.eslintrc.json), [`frontend/.eslintrc.json`](/frontend/.eslintrc.json)

### TypeScript Guidelines

- **No `any` types** (use specific types or `unknown`)
- **Use interfaces** for public APIs
- **Use type aliases** for unions/intersections
- **Enable strict mode** in `tsconfig.json`
- **Add JSDoc comments** for public APIs

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `api-client.ts`)
- **Components**: `PascalCase.tsx` (e.g., `DataTable.tsx`)
- **Variables/Functions**: `camelCase` (e.g., `getUserById`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`)
- **Classes/Interfaces**: `PascalCase` (e.g., `UserService`)

---

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Writing Tests

- **Unit tests**: Test individual functions/classes
- **Integration tests**: Test API endpoints and database interactions
- **E2E tests**: Test full user workflows

Example test structure:
```typescript
describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '123';
      // Act
      const user = await getUserById(userId);
      // Assert
      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
    });
  });
});
```

### Test Coverage

We aim for **>80% coverage** on new code. Check coverage:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

---

## Commit Messages

We follow **Conventional Commits** specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions/changes
- `chore`: Build/process changes
- `ci`: CI/CD changes

### Examples

```bash
# Simple feature
git commit -m "feat(auth): add JWT refresh token support"

# Bug fix with description
git commit -m "fix(api): resolve race condition in data export

The previous implementation had a race condition when multiple
export jobs ran simultaneously. This fix adds proper locking.

Closes #123"

# Breaking change
git commit -m "feat(api)!: change response format

BREAKING CHANGE: API responses now use camelCase instead of
snake_case. Update your clients accordingly."
```

---

## Pull Requests

### Before Submitting

1. **Update documentation** if your changes affect user-facing features
2. **Add tests** for new functionality
3. **Ensure all tests pass**: `npm test`
4. **Run linting**: `npm run lint`
5. **Check formatting**: `npm run format:check`

### Submitting a PR

1. **Push your branch**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub
   - Use a descriptive title (e.g., "feat: Add JWT refresh token support")
   - Reference related issues (e.g., "Closes #123")
   - Describe what you changed and why

3. **Wait for review**
   - Maintainers will review your PR
   - Address any feedback or requests for changes

4. **Approval and merge**
   - Once approved, your PR will be merged
   - Congratulations! 🎉

### PR Review Checklist

Maintainers will check:
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] Commit messages follow conventions
- [ ] No merge conflicts
- [ ] CI/CD pipeline passes

---

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Clear title**: "Error 500 when creating dataset with special characters"
2. **Steps to reproduce**:
   ```bash
   1. Go to /datasets/new
   2. Enter name: "test@dataset"
   3. Click Create
   4. See error
   ```
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Environment**:
   - OS: [e.g., Ubuntu 22.04]
   - Node.js: [e.g., 18.20.0]
   - Browser: [e.g., Chrome 123]

### Feature Requests

When requesting features:

1. **Use case**: What problem would this solve?
2. **Proposed solution**: How should it work?
3. **Alternatives considered**: What other approaches did you think of?
4. **Priority**: How important is this? (critical/important/nice-to-have)

---

## Getting Help

- **Documentation**: Check [`docs/`](/docs/) directory
- **Issues**: Search existing GitHub issues
- **Discussions**: Start a GitHub discussion
- **Chat**: Join our community chat (link coming soon)

---

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something great together.

### Our Pledge

- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Gracefully accept constructive criticism
- Focus on what is best for the community

### Unacceptable Behavior

- Harassment or derogatory comments
- Personal attacks or insults
- Public or private harassment
- Publishing others' private information

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

## Recognition

Contributors will be recognized in:
- [`CONTRIBUTORS.md`](/CONTRIBUTORS.md) (coming soon)
- Release notes
- Project README

Thank you for contributing! 🙏
