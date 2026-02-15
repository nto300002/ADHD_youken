import { http, HttpResponse } from 'msw';

// モックユーザーデータ
export const mockGitHubUser = {
  id: 12345678,
  login: 'testuser',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345678',
  name: 'Test User',
  email: 'test@example.com',
};

// モックアクセストークン
export const mockAccessToken = 'gho_mock_access_token_1234567890';

export const handlers = [
  // GitHub OAuth トークン交換
  http.post('https://github.com/login/oauth/access_token', async () => {
    return HttpResponse.json({
      access_token: mockAccessToken,
      token_type: 'bearer',
      scope: 'read:user user:email',
    });
  }),

  // GitHub ユーザー情報取得
  http.get('https://api.github.com/user', ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || authHeader !== `Bearer ${mockAccessToken}`) {
      return new HttpResponse(null, { status: 401 });
    }

    return HttpResponse.json(mockGitHubUser);
  }),

  // GitHub ユーザーメール取得
  http.get('https://api.github.com/user/emails', ({ request }) => {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || authHeader !== `Bearer ${mockAccessToken}`) {
      return new HttpResponse(null, { status: 401 });
    }

    return HttpResponse.json([
      {
        email: mockGitHubUser.email,
        primary: true,
        verified: true,
        visibility: 'public',
      },
    ]);
  }),
];
