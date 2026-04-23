# Contributing to Oddsify Labs - Agent Command Center

Thank you for your interest in contributing! We welcome bug reports, feature requests, and pull requests.

## Code of Conduct

Please be respectful and constructive. We're building a community-driven project.

## Getting Started

### Report a Bug

1. Check if the bug has already been reported in [Issues](https://github.com/oddsify-labs/agent-command-center/issues)
2. If not, create a new issue with:
   - Clear title describing the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - System info (Node.js version, OS, etc.)
   - Screenshots if applicable

### Request a Feature

1. Check [Issues](https://github.com/oddsify-labs/agent-command-center/issues) and [Discussions](https://github.com/oddsify-labs/agent-command-center/discussions)
2. Create a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Proposed API/UI changes (if applicable)

### Submit Code

1. **Fork** the repository
2. **Clone** your fork locally
   ```bash
   git clone https://github.com/YOUR-USERNAME/agent-command-center.git
   cd agent-command-center
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Make your changes**
   - Follow the existing code style
   - Add tests for new features
   - Update documentation if needed

6. **Test your changes**
   ```bash
   npm test
   npm run lint
   ```

7. **Commit with clear messages**
   ```bash
   git commit -am 'Add description of changes'
   ```

8. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

9. **Open a Pull Request**
   - Link any related issues
   - Describe what you changed and why
   - Wait for review

## Code Style

- **Indentation:** 2 spaces
- **Semicolons:** Required
- **Naming:** camelCase for variables/functions, PascalCase for classes
- **Comments:** Clear and concise
- **No console.log:** Use proper logging instead

Example:
```javascript
// ✅ Good
class TaskQueue {
  enqueueTask(workerId, task) {
    const taskId = uuidv4();
    this.queues[workerId].push({ id: taskId, ...task });
    return taskId;
  }
}

// ❌ Bad
class TaskQueue{
  enqueueTask(workerId,task){console.log(task);this.queues[workerId].push(task)}
}
```

## Commit Message Format

```
[Type] Brief description

More detailed explanation if needed.

Fixes #123
```

Types: `[Feature]`, `[Fix]`, `[Docs]`, `[Refactor]`, `[Test]`, `[Chore]`

Examples:
- `[Feature] Add WebSocket support for real-time updates`
- `[Fix] Resolve SSH timeout issue with Miah agent`
- `[Docs] Update deployment guide for Hostinger`

## Pull Request Process

1. Update documentation and tests
2. Ensure all tests pass: `npm test`
3. Ensure code is linted: `npm run lint`
4. Wait for at least one maintainer review
5. Address any feedback
6. Once approved, your PR will be merged

## Areas for Contribution

### High Priority
- [ ] Database persistence (MongoDB/PostgreSQL adapter)
- [ ] WebSocket real-time updates
- [ ] Python SDK for custom agents
- [ ] Docker/Kubernetes deployment templates

### Medium Priority
- [ ] Slack integration
- [ ] Agent health checks
- [ ] Multi-tenant support
- [ ] API documentation (OpenAPI/Swagger)

### Community Contributions
- [ ] Bug fixes
- [ ] Documentation improvements
- [ ] Example agents
- [ ] Deployment guides for other platforms

## Running Tests

```bash
npm test
```

## Building Documentation

```bash
npm run docs
```

## Reporting Security Issues

**Do not** open a public issue for security vulnerabilities. Email security@oddsify-labs.com instead.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

- GitHub Discussions: https://github.com/oddsify-labs/agent-command-center/discussions
- Email: dev@oddsify-labs.com
- Twitter: @OddsifyLabs

Thank you for contributing! 🙏
