# bpro

## Build & Development

```bash
# Build
npm run build

# Dev
npm run dev

# Test
# TODO: add test command
```

## Architecture

- Language: TypeScript
- Project managed by Fugue (see .fugue/)

## REQ Reference Rules

- All commits should include REQ-ID in the message: `feat: description (REQ-XXX-NNN)`
- `fugue sync` maps commits to traceability matrix
- `fugue verify` checks test coverage for changed REQs

## Agent Boundaries

<!-- Define which agents own which directories -->
<!-- Example:
- api-dev: src/api/, src/services/
- ui-dev: src/components/, src/pages/
-->
