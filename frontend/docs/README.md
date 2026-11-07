# Frontend documentation map

Read [AGENTS.md](../AGENTS.md) and [product requirements](../FRONTEND-REQUIREMENTS.md)
before changing learning flows. These guides describe source inspected on
2026-11-07. Check current implementation and tests when planning a change.

| Task | Guide |
| --- | --- |
| Find providers, routes, components, and API boundaries | [Composition](COMPOSITION.md) |
| Change daily practice, answers, reveal, playback, or layouts | [Exercise flows](EXERCISE-FLOWS.md) |
| Pick files, tests, and a development workflow | [Development](DEVELOPMENT.md) |
| Read feature behavior and browser regression notes | [Application README](../README.md) |

Backend source lives in the separate [ViggoSkj/ChappBackend](https://github.com/ViggoSkj/ChappBackend)
repository. Its `docs/README.md` maps composition, persistence, feature contracts,
and deployment. Frontend interfaces alone do not establish server authorization,
stored data semantics, or which version is deployed.
