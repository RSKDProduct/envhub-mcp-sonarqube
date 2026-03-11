#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SonarQubeClient } from './sonarqube-client.js';

// Env vars are optional defaults — credentials can be provided per-request
const DEFAULT_SONARQUBE_URL = process.env.SONARQUBE_URL;
const DEFAULT_SONARQUBE_TOKEN = process.env.SONARQUBE_TOKEN;

// Default client (may be null if no env vars set)
const defaultClient =
  DEFAULT_SONARQUBE_URL && DEFAULT_SONARQUBE_TOKEN
    ? new SonarQubeClient(DEFAULT_SONARQUBE_URL, DEFAULT_SONARQUBE_TOKEN)
    : null;

/**
 * Resolve the client to use for a tool call.
 * Per-request url/token override the env defaults.
 */
function resolveClient(url?: string, token?: string): SonarQubeClient {
  const effectiveUrl = url || DEFAULT_SONARQUBE_URL;
  const effectiveToken = token || DEFAULT_SONARQUBE_TOKEN;

  if (!effectiveUrl || !effectiveToken) {
    throw new Error(
      'No SonarQube credentials provided. Set SONARQUBE_URL and SONARQUBE_TOKEN env vars or pass url/token per request.',
    );
  }

  // Return default if no overrides
  if (!url && !token && defaultClient) return defaultClient;

  return new SonarQubeClient(effectiveUrl, effectiveToken);
}

// Common credential schema shared by all tools
const credentialSchema = {
  url: z.string().optional().describe('SonarQube server URL (overrides SONARQUBE_URL env var)'),
  token: z.string().optional().describe('SonarQube authentication token (overrides SONARQUBE_TOKEN env var)'),
};

const server = new McpServer({
  name: 'envhub-mcp-sonarqube',
  version: '1.0.0',
});

server.tool(
  'sonarqube_get_quality_gate',
  'Get the quality gate status for a SonarQube project (pass/fail with conditions)',
  {
    ...credentialSchema,
    projectKey: z.string().describe('SonarQube project key'),
  },
  async ({ url, token, projectKey }) => {
    const c = resolveClient(url, token);
    const result = await c.getQualityGate({ projectKey });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_issues',
  'Search for code issues (bugs, vulnerabilities, code smells) in a project',
  {
    ...credentialSchema,
    projectKey: z.string().describe('SonarQube project key'),
    types: z.string().optional().describe('Issue types: BUG, VULNERABILITY, CODE_SMELL (comma-separated)'),
    severities: z.string().optional().describe('Severities: BLOCKER, CRITICAL, MAJOR, MINOR, INFO'),
    statuses: z.string().optional().describe('Statuses: OPEN, CONFIRMED, REOPENED, RESOLVED, CLOSED'),
    page: z.number().optional().describe('Page number (default: 1)'),
    pageSize: z.number().optional().describe('Page size (default: 100, max: 500)'),
  },
  async ({ url, token, projectKey, types, severities, statuses, page, pageSize }) => {
    const c = resolveClient(url, token);
    const result = await c.getIssues({ projectKey, types, severities, statuses, page, pageSize });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_measures',
  'Get code metrics like coverage, complexity, and duplications for a project',
  {
    ...credentialSchema,
    projectKey: z.string().describe('SonarQube project key'),
    metricKeys: z.array(z.string()).describe('Metric keys (e.g., coverage, ncloc, complexity, duplicated_lines_density)'),
  },
  async ({ url, token, projectKey, metricKeys }) => {
    const c = resolveClient(url, token);
    const result = await c.getMeasures({ projectKey, metricKeys });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_project_status',
  'Get overall project analysis status including last analysis date and quality profile',
  {
    ...credentialSchema,
    projectKey: z.string().describe('SonarQube project key'),
  },
  async ({ url, token, projectKey }) => {
    const c = resolveClient(url, token);
    const result = await c.getProjectStatus({ projectKey });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_search_projects',
  'Search for projects on the SonarQube instance',
  {
    ...credentialSchema,
    query: z.string().optional().describe('Search query string'),
    page: z.number().optional().describe('Page number'),
    pageSize: z.number().optional().describe('Page size (max: 500)'),
  },
  async ({ url, token, query, page, pageSize }) => {
    const c = resolveClient(url, token);
    const result = await c.searchProjects({ query, page, pageSize });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_hotspots',
  'Get security hotspots for a project that need manual review',
  {
    ...credentialSchema,
    projectKey: z.string().describe('SonarQube project key'),
    status: z.string().optional().describe('Hotspot status filter (TO_REVIEW, REVIEWED)'),
    page: z.number().optional().describe('Page number'),
    pageSize: z.number().optional().describe('Page size'),
  },
  async ({ url, token, projectKey, status, page, pageSize }) => {
    const c = resolveClient(url, token);
    const result = await c.getHotspots({ projectKey, status, page, pageSize });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_rules',
  'Search analysis rules configured on the SonarQube instance',
  {
    ...credentialSchema,
    languages: z.string().optional().describe('Filter by language (e.g., java, js, ts)'),
    types: z.string().optional().describe('Filter by type (BUG, VULNERABILITY, CODE_SMELL)'),
    page: z.number().optional().describe('Page number'),
    pageSize: z.number().optional().describe('Page size'),
  },
  async ({ url, token, languages, types, page, pageSize }) => {
    const c = resolveClient(url, token);
    const result = await c.getRules({ languages, types, page, pageSize });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_project_branches',
  'List all analyzed branches of a project and their analysis status',
  {
    ...credentialSchema,
    projectKey: z.string().describe('SonarQube project key'),
  },
  async ({ url, token, projectKey }) => {
    const c = resolveClient(url, token);
    const result = await c.getProjectBranches({ projectKey });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
