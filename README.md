# WAL Service Documentation Index

Welcome to the WAL Service documentation. This index helps you navigate through all available documentation.

## 📚 Documentation Overview

### 🚀 Getting Started

| Document | Description | Audience |
|----------|-------------|----------|
| [README.md](../README.md) | Project overview and quick start | Everyone |
| [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) | Complete local development setup guide | Developers |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions | Developers, DevOps |

### 🏗️ Architecture & Design

| Document | Description | Audience |
|----------|-------------|----------|
| [PRD.md](./PRD.md) | Product Requirements Document | Product, Engineering |
| [HLD.md](./HLD.md) | High-Level Design | Architects, Senior Engineers |
| [LLD.md](./LLD.md) | Low-Level Design | Engineers, Implementers |

### 📖 Development Guides

**[LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md)**
- Prerequisites and tool installation
- Step-by-step cluster setup
- Development workflow
- Configuration and customization

**[SKAFFOLD_DEVELOPMENT.md](./docs/SKAFFOLD_DEVELOPMENT.md)**
- Hot reload development workflow
- File synchronization and debugging
- Rapid iteration with Kubernetes
- IDE integration and performance tips

**[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)**
- Port conflict resolution
- Docker and Kubernetes issues
- PATH and environment problems
- Recovery procedures

## 🗂️ Quick Reference

### Common Commands

```bash
# Cluster management
make cluster-start      # Start local Kubernetes cluster
make cluster-stop       # Stop cluster
make cluster-reset      # Reset cluster completely

# Skaffold development (recommended)
make dev-start          # Start development with hot reload
make dev-debug          # Start with debugging enabled
make dev-build          # Build development image
make dev-delete         # Clean up deployment

# Traditional development
npm run start:dev       # Start application locally
npm run test           # Run tests
npm run build          # Build for production
```

### Important Files

| File | Purpose |
|------|---------|
| `scripts/setup-local-k8s.sh` | Kubernetes cluster setup script |
| `kind-config.yaml` | Kind cluster configuration |
| `Makefile` | Development commands |
| `k8s/` | Kubernetes manifests |

### Port Configuration

| Port | Service | Purpose |
|------|---------|---------|
| 80 | Ingress | HTTP traffic to services |
| 443 | Ingress | HTTPS traffic to services |
| 6000 | Registry | Local Docker registry |
| 3000 | Application | WAL Service API |

## 🔍 Finding Information

### By Use Case

**I want to...**

- **Start developing locally** → [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- **Fix cluster startup issues** → [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Understand the architecture** → [HLD.md](./HLD.md) then [LLD.md](./LLD.md)
- **See what features are planned** → [PRD.md](./PRD.md)
- **Get a quick overview** → [README.md](../README.md)

### By Role

**Developers:**
1. Start with [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
2. Keep [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) handy
3. Reference [LLD.md](./LLD.md) for implementation details

**DevOps/SRE:**
1. Review [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for environment setup
2. Study [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for operational issues
3. Check [HLD.md](./HLD.md) for deployment architecture

**Product/Management:**
1. Read [PRD.md](./PRD.md) for requirements and scope
2. Review [HLD.md](./HLD.md) for architecture overview
3. Check [README.md](../README.md) for current status

**New Team Members:**
1. [README.md](../README.md) - Project overview
2. [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) - Get environment running
3. [PRD.md](./PRD.md) - Understand the product
4. [HLD.md](./HLD.md) - Learn the architecture
5. [LLD.md](./LLD.md) - Dive into implementation

## 📋 Document Status

| Document | Last Updated | Status |
|----------|-------------|---------|
| README.md | Oct 4, 2025 | ✅ Current |
| LOCAL_DEVELOPMENT.md | Oct 4, 2025 | ✅ Current |
| TROUBLESHOOTING.md | Oct 4, 2025 | ✅ Current |
| PRD.md | - | 📝 Existing |
| HLD.md | - | 📝 Existing |
| LLD.md | - | 📝 Existing |

## 🤝 Contributing to Documentation

When updating documentation:

1. **Keep it current** - Update dates and version information
2. **Be specific** - Include exact commands and file paths
3. **Test instructions** - Verify all commands work as documented
4. **Link between docs** - Reference related documents
5. **Update this index** - Add new documents to the appropriate sections

### Documentation Standards

- Use clear, descriptive headings
- Include code examples that can be copy-pasted
- Add troubleshooting sections for complex procedures
- Use consistent formatting and style
- Include "Last updated" dates

## 📞 Getting Help

If you can't find what you're looking for:

1. **Search this index** for keywords
2. **Check the troubleshooting guide** for common issues
3. **Review the architecture docs** for system understanding
4. **Ask the team** if documentation is missing or unclear

---

*This index was created to help navigate the WAL Service documentation effectively. Please keep it updated as new documentation is added.*

*Last updated: October 4, 2025*