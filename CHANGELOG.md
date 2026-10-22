# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-23

### Added
- **Backward CPM Scheduler (`scheduleForTarget`)**: Pure TypeScript implementation of the Backward Critical Path Method using Kahn's topological sort ($\mathcal{O}(V+E)$). Computes early/late starts, early/late finishes, and total float.
- **Dynamic Shock-Absorber (`replanAfterDelay`)**: Automatic delay absorption leveraging Harold McGee resting compression food safety floors and float slack shifting.
- **Graph Validation (`validateTaskGraph`)**: Circular dependency cycle detection and duration/predecessor integrity checks.
- **Microsecond Benchmarks (`tests/benchmark.ts`)**: High-resolution latency profiling verifying sub-millisecond execution across 10 to 500 tasks.
- **Full TypeScript Type Declarations**: Modern ESM with dual-export maps and `.d.ts` declaration maps.
- **GitHub Actions CI Workflow**: Matrix automated test runner testing across Node.js 20.x and 22.x.
- **MIT Open Source License**: Unrestricted open-source release for the Amazon Developer Hackathon 2026 Open Source Mini-Challenge.
