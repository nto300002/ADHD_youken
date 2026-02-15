import { sign, verify } from 'hono/jwt';

export interface JWTPayload {
  userId: string;
  login: string;
  exp?: number;
  iat?: number;
}

export interface JWTOptions {
  expiresIn?: string;
}

/**
 * JWT時間文字列をミリ秒に変換
 * 例: '1h' -> 3600000, '7d' -> 604800000
 */
function parseExpiration(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid expiresIn format: ${expiresIn}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * JWTトークンを生成
 */
export async function generateJWT(
  payload: Omit<JWTPayload, 'exp' | 'iat'>,
  secret: string,
  options?: JWTOptions
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const jwtPayload: JWTPayload = {
    ...payload,
    iat: now,
  };

  if (options?.expiresIn) {
    const expirationMs = parseExpiration(options.expiresIn);
    jwtPayload.exp = now + Math.floor(expirationMs / 1000);
  }

  return await sign(jwtPayload, secret, 'HS256');
}

/**
 * JWTトークンを検証・デコード
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload> {
  try {
    const payload = await verify(token, secret, 'HS256') as JWTPayload;

    // 有効期限チェック
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('JWT verification failed');
  }
}
