// Mock Octokit for Jest
const mockGitHubUser = {
  id: 12345678,
  login: 'testuser',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345678',
  name: 'Test User',
  email: 'test@example.com',
};

export class Octokit {
  constructor(options?: { auth?: string }) {}

  rest = {
    users: {
      getAuthenticated: async () => ({
        data: mockGitHubUser,
      }),
    },
  };
}
