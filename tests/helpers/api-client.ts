// API helper cho UAT runner — login + Cases CRUD qua HTTP truc tiep
import { APIRequestContext, request } from '@playwright/test';

export interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    role: string;
    canDispatch: boolean;
  };
}

export class ApiClient {
  private context!: APIRequestContext;
  public token = '';
  public user: LoginResult['user'] | null = null;

  constructor(public readonly apiBase: string) {}

  async init(): Promise<void> {
    this.context = await request.newContext({ baseURL: this.apiBase });
  }

  async login(username: string, password: string): Promise<LoginResult> {
    const res = await this.context.post('/auth/login', {
      data: { username, password },
    });
    if (!res.ok()) {
      throw new Error(`Login failed (${res.status()}): ${await res.text()}`);
    }
    const body = (await res.json()) as LoginResult;
    this.token = body.accessToken;
    this.user = body.user;
    return body;
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async createCase(payload: Record<string, unknown>) {
    return this.context.post('/cases', {
      headers: this.authHeaders(),
      data: payload,
    });
  }

  async getCase(id: string) {
    return this.context.get(`/cases/${id}`, { headers: this.authHeaders() });
  }

  async listCases(query: Record<string, string | number | boolean> = {}) {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(query).map(([k, v]) => [k, String(v)]),
      ),
    ).toString();
    return this.context.get(`/cases${qs ? `?${qs}` : ''}`, {
      headers: this.authHeaders(),
    });
  }

  async updateCase(id: string, payload: Record<string, unknown>) {
    return this.context.put(`/cases/${id}`, {
      headers: this.authHeaders(),
      data: payload,
    });
  }

  async deleteCase(id: string, reason: string) {
    return this.context.delete(`/cases/${id}`, {
      headers: this.authHeaders(),
      data: { reason },
    });
  }

  async restoreCase(id: string, reason: string) {
    return this.context.post(`/cases/${id}/restore`, {
      headers: this.authHeaders(),
      data: { reason },
    });
  }

  async getStatusHistory(id: string) {
    return this.context.get(`/cases/${id}/status-history`, {
      headers: this.authHeaders(),
    });
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}
