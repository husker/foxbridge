# Foxbridge

**MCP tools and AI chat for Atlassian workflows, running on your own infrastructure.**

Foxbridge connects coding agents and a browser chat interface to Jira, Confluence, Bitbucket and Assets. Ask an agent to investigate an issue, gather the relevant documentation, summarize a sprint or prepare an update. Tools make the API calls using the requesting user's Atlassian credentials.

This is an experimental project released from a discontinued, pre-launch product. It is useful as a starting point for building agent integrations; it is not a production-hardened service. The setup wizard targets **Atlassian Data Center**. Cloud clients and an OAuth implementation remain in the source, but are experimental and are not part of the guided setup.

## What it demonstrates

- **MCP integration:** tools with structured schemas, product-level read/write controls and Streamable HTTP transport.
- **Agent workflows:** an AI tool loop that can search, inspect and act across Atlassian products, with a limit of ten iterations per response.
- **A full-stack interface:** streaming chat, saved conversations, pinned prompts, reusable workflow prompts and a resizable Jira detail panel that renders Jira wiki content.
- **Provider choice:** adapters for Anthropic, OpenAI, Azure OpenAI and Ollama. Model/tool compatibility depends on the provider and selected model.
- **Optional data scrubbing:** pattern-based filtering and name pseudonyms for supported tool responses.

Saved workflow prompts are shortcuts that you run from chat. Foxbridge does not schedule jobs or run background automations on its own.

## Example workflows

Start with read-only tools and a sandbox project:

- “Find my unresolved issues and summarize the ones blocked by another team.”
- “Read DEMO-123, find related Confluence pages and list the missing information.”
- “Summarize this sprint's open work and draft a stand-up update.”

When write tools are enabled, agents can also create or update issues, add comments and change other supported records. **Writes execute without a separate approval screen.** Enable them deliberately and use least-privilege Atlassian accounts.

## Run locally

Requires Node.js **22.13+ or 24**, npm, a reachable Atlassian instance, and a model that supports tool calling. Use a Personal Access Token for the Data Center login. Basic authentication is also available where the instance permits it.

```sh
npm ci --ignore-scripts
npm run build
cp config.example.yaml foxbridge.yaml
```

Edit `foxbridge.yaml`: set the Atlassian URL, enable the products you have, and configure your model provider. The example uses an Ollama server on `localhost:11434`; install and serve the chosen model separately. For a hosted provider, change `ai.provider`, supply `ai.api_key`, and choose an available model.

```sh
npm start
```

Open **http://localhost:3000** and sign in with your Atlassian username and token. The MCP endpoint is **http://localhost:3001/mcp**. No Foxbridge account, paid license key or licensing service is required.

`dev_mode: true` in the example permits cookies over local HTTP. For a network deployment, use HTTPS and set `dev_mode: false`. Restrict access with your network or reverse proxy; the Node servers are not an internet-facing security boundary.

## Run with Docker

```sh
docker compose up --build -d
```

Open **http://localhost:3000** to complete the first-run setup. The wizard saves configuration in the `foxbridge-data` volume and restarts the service. Both published ports bind to loopback by default. Keep setup private: while unconfigured, the wizard accepts configuration without authentication.

Alternatively, copy the example to `config.yaml`, edit it, and uncomment the read-only config mount in `docker-compose.yaml`. On Docker Desktop, use `http://host.docker.internal:11434` to reach Ollama on the host. On Linux, configure a reachable model-service address for your container network.

The image is built from this checkout; no hosted container registry or commercial service is required. The volume may contain provider credentials. Protect it and any backups.

## Connect an MCP client

Configure a client that supports Streamable HTTP and custom headers:

| Setting | Value |
| --- | --- |
| Transport | Streamable HTTP |
| URL | `http://localhost:3001/mcp` |
| `X-Foxbridge-User` | Your Atlassian username |
| `X-Foxbridge-Token` | Your Atlassian token |

Use the client's secret store or local environment references for these header values. Do not commit them to project configuration. Use HTTPS whenever the client and server communicate over a network.

Tools include `jira_search_issues`, `jira_read_issue`, `jira_list_comments`, and the Confluence, Bitbucket and Assets tools in [tool-defs.ts](packages/mcp-servers/src/tool-defs.ts). Product read/write switches determine which tools are exposed. Atlassian still enforces the supplied credentials' permissions. For MCP-only use, the external agent supplies the model; Foxbridge's `ai` settings are used by its web chat.

## How it fits together

```text
MCP client ──> HTTP tools ────────────> Atlassian APIs
                   │                     ▲
                   └─ per-user token ────┘

Browser ──> Express chat ──> model/tool loop ──> Atlassian APIs
                                │
                                └─ configured AI provider
```

| Package | Responsibility |
| --- | --- |
| `config` | Configuration validation, discovery and writing |
| `atlassian` | Product clients and response normalization |
| `mcp-servers` | MCP schemas, tools, feature switches and transport |
| `chat-backend` | Authentication, sessions, file parsing and agent loop |
| `chat-ui` | React chat, workflows, history and issue details |
| `scrubber` | Best-effort filtering of supported sensitive patterns |

Configuration is discovered from `FOXBRIDGE_CONFIG`, `./foxbridge.yaml`, `/etc/foxbridge/config.yaml`, then `/var/lib/foxbridge/config.yaml`. Per-product URLs support deployments with separate Jira, Confluence and Bitbucket hosts. See [config.example.yaml](config.example.yaml).

## Data handling and limitations

Self-hosting Foxbridge does not mean all data stays on your machine. Web chat sends prompts, relevant tool results and uploaded content to the configured AI provider. With an external MCP client, that client controls its own model and data handling.

- Atlassian credentials and active chat sessions are held in server memory; sessions expire after eight hours. Restarting the server clears them.
- The browser saves conversation text and workflow prompts in local storage. That storage is shared by people using the same browser profile and origin, and is not a secure, per-user vault. Clear site data on shared devices.
- Provider API keys and optional OAuth secrets are stored in the configuration file. Wizard-written files use owner-only permissions on POSIX systems. Protect manually created files too.
- The scrubber is best effort. It does not reliably remove all sensitive material, sanitize every log field, or scrub uploaded documents and user prompts before they reach the model.
- Retrieved issues and documents are untrusted input to the model. Prompt injection can influence tool use. Keep write access disabled until the workflow and permissions are appropriate.
- There is no distributed session store, production rate limiting, or comprehensive security assessment. File parsing runs inside the service process. Avoid exposing it to untrusted uploads.
- Automated tests use fixtures and mocked external services. They do not certify compatibility with a live Atlassian deployment or a particular model.

## Development and checks

```sh
npm run build
npm run typecheck
npm test
```

For frontend development, start the backend on port 3000 and run `npm run dev -w @foxbridge/chat-ui` in another terminal. Vite proxies `/api` to the backend.

Tests cover product clients, schemas, feature controls, sessions, the scrubber and UI behavior, plus local HTTP integration tests.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before adding examples or fixtures, and [SECURITY.md](SECURITY.md) for security-reporting guidance.

## License

[MIT](LICENSE). Dependencies retain their respective licenses.
