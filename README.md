# EnvHub MCP SonarQube Server

A Model Context Protocol (MCP) server that provides SonarQube code quality tools for AI assistants like Claude.

## Tools (8)

| Tool | Description |
|------|-------------|
| `sonarqube_get_quality_gate` | Get quality gate status (pass/fail) |
| `sonarqube_get_issues` | Search bugs, vulnerabilities, code smells |
| `sonarqube_get_measures` | Get metrics (coverage, complexity) |
| `sonarqube_get_project_status` | Overall project analysis status |
| `sonarqube_search_projects` | Search projects on instance |
| `sonarqube_get_hotspots` | Security hotspots for review |
| `sonarqube_get_rules` | Analysis rules configuration |
| `sonarqube_get_project_branches` | List analyzed branches |

## Configuration

```bash
export SONARQUBE_URL=http://localhost:9000
export SONARQUBE_TOKEN=squ_your_token_here
```

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sonarqube": {
      "command": "node",
      "args": ["/path/to/envhub-mcp-sonarqube/dist/index.js"],
      "env": {
        "SONARQUBE_URL": "http://your-sonarqube:9000",
        "SONARQUBE_TOKEN": "squ_xxx"
      }
    }
  }
}
```

## Development

```bash
npm install
npm run build
npm run dev
```

## Docker

```bash
docker build -t envhub-mcp-sonarqube .
docker run -e SONARQUBE_URL=http://sonar:9000 -e SONARQUBE_TOKEN=squ_xxx envhub-mcp-sonarqube
```
