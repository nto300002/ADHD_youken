import type { Env } from '@/index';

// モックD1Database
export class MockD1Database implements D1Database {
  public users: any[] = [];

  async prepare(query: string) {
    const self = this;

    return {
      bind: (...values: any[]) => ({
        all: async () => ({
          results: self.users,
          success: true,
          meta: {}
        }),
        first: async () => self.users[0] || null,
        run: async () => {
          // INSERT or UPDATE 操作をシミュレート
          if (query.toLowerCase().includes('insert')) {
            // 新しいユーザーを追加（簡易的な実装）
            const user = {
              id: values[0] || 'test-id-1',
              github_id: values[1] || 12345678,
              login: values[2] || 'testuser',
              avatar_url: values[3] || 'https://avatars.githubusercontent.com/u/12345678',
              access_token: values[4] || 'encrypted_token',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            // onConflictDoUpdate をシミュレート
            const existingIndex = self.users.findIndex(u => u.github_id === user.github_id);
            if (existingIndex !== -1) {
              self.users[existingIndex] = { ...self.users[existingIndex], ...user };
            } else {
              self.users.push(user);
            }
          }

          return { success: true, meta: {} };
        },
      }),
      all: async () => ({
        results: self.users,
        success: true,
        meta: {}
      }),
      first: async () => self.users[0] || null,
      run: async () => ({ success: true, meta: {} }),
    } as any;
  }

  async dump() {
    return new ArrayBuffer(0);
  }

  async batch(statements: any[]) {
    return statements.map(() => ({ results: [], success: true, meta: {} }));
  }

  async exec(query: string) {
    return { count: 0, duration: 0 };
  }
}

// モックKVNamespace
export class MockKVNamespace implements KVNamespace {
  private data: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list() {
    return { keys: [], list_complete: true, cursor: '' } as any;
  }

  async getWithMetadata(key: string) {
    return { value: this.data.get(key) || null, metadata: null } as any;
  }

  setData(key: string, value: string) {
    this.data.set(key, value);
  }
}

// テスト用Env作成
export function createTestEnv(overrides?: Partial<Env>): Env {
  return {
    DB: new MockD1Database() as any,
    KV: new MockKVNamespace() as any,
    GITHUB_CLIENT_ID: 'test_client_id',
    GITHUB_CLIENT_SECRET: 'test_client_secret',
    JWT_SECRET: 'test_jwt_secret_key_minimum_32_chars_long',
    ENCRYPTION_KEY: 'test_encryption_key_32_chars_x',
    FRONTEND_URL: 'http://localhost:3000',
    ...overrides,
  };
}
