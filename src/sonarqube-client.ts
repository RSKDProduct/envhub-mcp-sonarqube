/**
 * SonarQube REST API Client
 *
 * Uses Basic auth with token as username and empty password
 * (SonarQube's standard authentication pattern).
 */

const REQUEST_TIMEOUT_MS = 30_000;

export class SonarQubeClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  /** 1. Get quality gate status for a project */
  async getQualityGate(params: { projectKey: string }): Promise<unknown> {
    const query = new URLSearchParams({ projectKey: params.projectKey });
    return this.request('GET', `/api/qualitygates/project_status?${query}`);
  }

  /** 2. Search issues (bugs, vulnerabilities, code smells) */
  async getIssues(params: {
    projectKey: string;
    types?: string;
    severities?: string;
    statuses?: string;
    page?: number;
    pageSize?: number;
  }): Promise<unknown> {
    const { projectKey, types, severities, statuses, page = 1, pageSize = 100 } = params;
    const query = new URLSearchParams({
      componentKeys: projectKey,
      p: String(page),
      ps: String(Math.min(pageSize, 500)),
    });
    if (types) query.set('types', types);
    if (severities) query.set('severities', severities);
    if (statuses) query.set('statuses', statuses);
    return this.request('GET', `/api/issues/search?${query}`);
  }

  /** 3. Get code metrics (coverage, complexity, duplications) */
  async getMeasures(params: { projectKey: string; metricKeys: string[] }): Promise<unknown> {
    const query = new URLSearchParams({
      component: params.projectKey,
      metricKeys: params.metricKeys.join(','),
    });
    return this.request('GET', `/api/measures/component?${query}`);
  }

  /** 4. Get project analysis status */
  async getProjectStatus(params: { projectKey: string }): Promise<unknown> {
    const query = new URLSearchParams({ component: params.projectKey });
    return this.request('GET', `/api/navigation/component?${query}`);
  }

  /** 5. Search for projects */
  async searchProjects(params: { query?: string; page?: number; pageSize?: number }): Promise<unknown> {
    const { query: searchQuery, page = 1, pageSize = 50 } = params;
    const queryParams = new URLSearchParams({
      p: String(page),
      ps: String(Math.min(pageSize, 500)),
    });
    if (searchQuery) queryParams.set('q', searchQuery);
    return this.request('GET', `/api/components/search_projects?${queryParams}`);
  }

  /** 6. Get security hotspots */
  async getHotspots(params: { projectKey: string; status?: string; page?: number; pageSize?: number }): Promise<unknown> {
    const { projectKey, status, page = 1, pageSize = 100 } = params;
    const query = new URLSearchParams({
      projectKey,
      p: String(page),
      ps: String(Math.min(pageSize, 500)),
    });
    if (status) query.set('status', status);
    return this.request('GET', `/api/hotspots/search?${query}`);
  }

  /** 7. Search analysis rules */
  async getRules(params: { languages?: string; types?: string; page?: number; pageSize?: number }): Promise<unknown> {
    const { languages, types, page = 1, pageSize = 100 } = params;
    const query = new URLSearchParams({
      p: String(page),
      ps: String(Math.min(pageSize, 500)),
    });
    if (languages) query.set('languages', languages);
    if (types) query.set('types', types);
    return this.request('GET', `/api/rules/search?${query}`);
  }

  /** 8. List project branches */
  async getProjectBranches(params: { projectKey: string }): Promise<unknown> {
    const query = new URLSearchParams({ project: params.projectKey });
    return this.request('GET', `/api/project_branches/list?${query}`);
  }

  // --- Internal HTTP client ---

  private async request(method: string, path: string): Promise<unknown> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const basicAuth = Buffer.from(`${this.token}:`).toString('base64');
    const headers: Record<string, string> = {
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
      'User-Agent': 'EnvHub-MCP-SonarQube/1.0',
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, { method, headers, signal: controller.signal });

      if (res.status === 401) {
        throw new Error('SonarQube authentication failed. Check that the API token is valid.');
      }
      if (res.status === 403) {
        throw new Error('SonarQube access denied. The token may lack required permissions.');
      }
      if (res.status === 404) {
        throw new Error(`SonarQube resource not found: ${method} ${path}`);
      }
      if (!res.ok) {
        let errorBody: string;
        try {
          const json = await res.json() as { errors?: Array<{ msg: string }>; message?: string };
          errorBody = json.errors ? json.errors.map(e => e.msg).join('; ') : json.message || JSON.stringify(json);
        } catch {
          errorBody = await res.text();
        }
        throw new Error(`SonarQube API error (${res.status}): ${errorBody}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
