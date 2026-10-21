# Contributing

Keep changes focused and include a test for changed behavior. Build before running tests because the workspaces resolve compiled package entry points:

```sh
npm ci --ignore-scripts
npm run build
npm run typecheck
npm test
```

Use fictional examples, reserved example domains and synthetic credentials in fixtures. Never copy real tickets, employee information, screenshots, deployment configuration, browser sessions or tokens into this repository.

For agent tools, explain the input schema, which Atlassian permission is needed and whether the operation can modify data. Keep read/write feature controls and user credential isolation intact. Tests should mock model and Atlassian calls; they must not use personal accounts or paid APIs.

Describe what you tested and any remaining limitations in your pull request. A mock test passing is not evidence that an integration has been tested against a live service.

The spreadsheet parser is pinned to the maintained SheetJS tarball from its [official distribution](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/). The lockfile records its integrity hash. `.npmrc` permits directly declared URL dependencies for npm 12; it does not enable arbitrary transitive URL installs.
