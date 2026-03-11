#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SonarQubeClient } from './sonarqube-client.js';

const SONARQUBE_URL = process.env.SONARQUBE_URL;
const SONARQUBE_TOKEN = process.env.SONARQUBE_TOKEN;

if (!SONARQUBE_URL || !SONARQUBE_TOKEN) {
  console.error('Error: SONARQUBE_URL and SONARQUBE_TOKEN environment variables are required');
  process.exit(1);
}

const client = new SonarQubeClient(SONARQUBE_URL, SONARQUBE_TOKEN);

const server = new McpServer({
  name: 'envhub-mcp-sonarqube',
  version: '1.0.0',
});

server.tool(
  'sonarqube_get_quality_gate',
  'Get the quality gate status for a SonarQube project (pass/fail with conditions)',
  { projectKey: z.string().describe('SonarQube project key') },
  async ({ projectKey }) => {
    const result = await client.getQualityGate({ projectKey });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_issues',
  'Search for code issues (bugs, vulnerabilities, code smells) in a project',
  {
    projectKey: z.string().describe('SonarQube project key'),
    types: z.string().optional().describe('Issue types: BUG, VULNERABILITY, CODE_SMELL (comma-separated)'),
    severities: z.string().optional().describe('Severities: BLOCKER, CRITICAL, MAJOR, MINOR, INFO'),
    statuses: z.string().optional().describe('Statuses: OPEN, CONFIRMED, REOPENED, RESOLVED, CLOSED'),
    page: z.number().optional().describe('Page number (default: 1)'),
    pageSize: z.number().optional().describe('Page size (default: 100, max: 500)'),
  },
  async ({ projectKey, types, severities, statuses, page, pageSize }) => {
    const result = await client.getIssues({ projectKey, types, severities, statuses, page, pageSize });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_measures',
  'Get code metrics like coverage, complexity, and duplications for a project',
  {
    projectKey: z.string().describe('SonarQube project key'),
    metricKeys: z.array(z.string()).describe('Metric keys (e.g., coverage, ncloc, complexity, duplicated_lines_density)'),
  },
  async ({ projectKey, metricKeys }) => {
    const result = await client.getMeasures({ projectKey, metricKeys });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_project_status',
  'Get overall project analysis status including last analysis date and quality profile',
  { projectKey: z.string().describe('SonarQube project key') },
  async ({ projectKey }) => {
    const result = await client.getProjectStatus({ projectKey });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_search_projects',
  'Search for projects on the SonarQube instance',
  {
    query: z.string().optional().describe('Search query string'),
    page: z.number().optional().describe('Page number'),
    pageSize: z.number().optional().describe('Page size (max: 500)'),
  },
  async ({ query, page, pageSize }) => {
    const result = await client.searchProjects({ query, page, pageSize });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_hotspots',
  'Get security hotspots for a project that need manual review',
  {
    projectKey: z.string().describe('SonarQube project key'),
    status: z.string().optional().describe('Hotspot status filter (TO_REVIEW, REVIEWED)'),
    page: z.number().optional().describe('Page number'),
    pageSize: z.number().optional().describe('Page size'),
  },
  async ({ projectKey, status, page, pageSize }) => {
    const result = await client.getHotspots({ projectKey, status, page, pageSize });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_rules',
  'Search analysis rules configured on the SonarQube instance',
  {
    languages: z.string().optional().describe('Filter by language (e.g., java, js, ts)'),
    types: z.string().optional().describe('Filter by type (BUG, VULNERABILITY, CODE_SMELL)'),
    page: z.number().optional().describe('Page number'),
    pageSize: z.number().optional().describe('Page size'),
  },
  async ({ languages, types, page, pageSize }) => {
    const result = await client.getRules({ languages, types, page, pageSize });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  'sonarqube_get_project_branches',
  'List all analyzed branches of a project and their analysis status',
  { projectKey: z.string().describe('SonarQube project key') },
  async ({ projectKey }) => {
    const result = await client.getProjectBranches({ projectKey });
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
