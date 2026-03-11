import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SonarQubeClient } from '../sonarqube-client.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SonarQubeClient', () => {
  let client: SonarQubeClient;

  beforeEach(() => {
    client = new SonarQubeClient('http://sonar:9000', 'test-token');
    vi.clearAllMocks();
  });

  function mockResponse(data: unknown, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data),
    });
  }

  describe('auth', () => {
    it('should use Basic auth with token as username', async () => {
      mockResponse({});
      await client.getQualityGate({ projectKey: 'test' });
      const opts = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = opts.headers as Record<string, string>;
      const expected = Buffer.from('test-token:').toString('base64');
      expect(headers.Authorization).toBe(`Basic ${expected}`);
    });
  });

  describe('getQualityGate', () => {
    it('should call correct endpoint', async () => {
      const gate = { projectStatus: { status: 'OK' } };
      mockResponse(gate);
      const result = await client.getQualityGate({ projectKey: 'my-project' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('http://sonar:9000/api/qualitygates/project_status?projectKey=my-project');
      expect(result).toEqual(gate);
    });
  });

  describe('getIssues', () => {
    it('should search with filters', async () => {
      mockResponse({ issues: [], total: 0 });
      await client.getIssues({ projectKey: 'proj', types: 'BUG', severities: 'CRITICAL', page: 2, pageSize: 50 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/issues/search');
      expect(url).toContain('componentKeys=proj');
      expect(url).toContain('types=BUG');
      expect(url).toContain('severities=CRITICAL');
      expect(url).toContain('p=2');
      expect(url).toContain('ps=50');
    });

    it('should cap pageSize at 500', async () => {
      mockResponse({ issues: [] });
      await client.getIssues({ projectKey: 'proj', pageSize: 1000 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('ps=500');
    });
  });

  describe('getMeasures', () => {
    it('should join metric keys', async () => {
      mockResponse({ component: {} });
      await client.getMeasures({ projectKey: 'proj', metricKeys: ['coverage', 'ncloc', 'complexity'] });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/measures/component');
      expect(url).toContain('metricKeys=coverage%2Cncloc%2Ccomplexity');
    });
  });

  describe('getProjectStatus', () => {
    it('should call navigation endpoint', async () => {
      mockResponse({ key: 'proj' });
      await client.getProjectStatus({ projectKey: 'proj' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/navigation/component?component=proj');
    });
  });

  describe('searchProjects', () => {
    it('should search with query', async () => {
      mockResponse({ components: [] });
      await client.searchProjects({ query: 'envhub' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/components/search_projects');
      expect(url).toContain('q=envhub');
    });

    it('should work without query', async () => {
      mockResponse({ components: [] });
      await client.searchProjects({});
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/components/search_projects');
      expect(url).not.toContain('q=');
    });
  });

  describe('getHotspots', () => {
    it('should filter by status', async () => {
      mockResponse({ hotspots: [] });
      await client.getHotspots({ projectKey: 'proj', status: 'TO_REVIEW' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/hotspots/search');
      expect(url).toContain('status=TO_REVIEW');
    });
  });

  describe('getRules', () => {
    it('should filter by language and type', async () => {
      mockResponse({ rules: [] });
      await client.getRules({ languages: 'ts', types: 'BUG' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/rules/search');
      expect(url).toContain('languages=ts');
      expect(url).toContain('types=BUG');
    });
  });

  describe('getProjectBranches', () => {
    it('should list branches', async () => {
      mockResponse({ branches: [{ name: 'main' }] });
      const result = await client.getProjectBranches({ projectKey: 'proj' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/project_branches/list?project=proj');
      expect(result).toEqual({ branches: [{ name: 'main' }] });
    });
  });

  describe('error handling', () => {
    it('should throw on 401', async () => {
      mockResponse({}, 401);
      await expect(client.getQualityGate({ projectKey: 'x' })).rejects.toThrow('authentication failed');
    });

    it('should throw on 403', async () => {
      mockResponse({}, 403);
      await expect(client.getQualityGate({ projectKey: 'x' })).rejects.toThrow('access denied');
    });

    it('should throw on 404', async () => {
      mockResponse({}, 404);
      await expect(client.getQualityGate({ projectKey: 'x' })).rejects.toThrow('not found');
    });

    it('should parse SonarQube error format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ errors: [{ msg: 'Invalid project key' }] }),
        text: async () => '{}',
      });
      await expect(client.getQualityGate({ projectKey: 'x' })).rejects.toThrow('Invalid project key');
    });
  });

  describe('URL normalization', () => {
    it('should strip trailing slashes from baseUrl', async () => {
      const c = new SonarQubeClient('http://sonar:9000///', 'tok');
      mockResponse({});
      await c.getQualityGate({ projectKey: 'proj' });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('http://sonar:9000/api/qualitygates/project_status?projectKey=proj');
    });
  });
});
