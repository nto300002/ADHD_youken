import type { Context } from 'hono';

/**
 * 環境に応じたエラーメッセージを返す
 * @param c Honoコンテキスト
 * @param detailedMessage 詳細なエラーメッセージ（開発環境用）
 * @param genericMessage 汎用的なエラーメッセージ（本番環境用）
 * @returns 環境に応じたエラーメッセージ
 */
export function getErrorMessage(
  c: Context,
  detailedMessage: string,
  genericMessage: string = 'An error occurred'
): string {
  // NODE_ENVまたはCF_PAGESで本番環境を判定
  const isProduction = 
    c.env?.NODE_ENV === 'production' ||
    c.env?.CF_PAGES === '1';

  return isProduction ? genericMessage : detailedMessage;
}

/**
 * エラーレスポンスを返す（環境に応じて詳細度を調整）
 * @param c Honoコンテキスト
 * @param status HTTPステータスコード
 * @param detailedMessage 詳細なエラーメッセージ
 * @param genericMessage 汎用的なエラーメッセージ
 * @returns JSONエラーレスポンス
 */
export function errorResponse(
  c: Context,
  status: number,
  detailedMessage: string,
  genericMessage?: string
) {
  const message = getErrorMessage(
    c,
    detailedMessage,
    genericMessage || 'An error occurred'
  );

  // 本番環境では詳細ログをコンソールに記録（分析用）
  const isProduction = 
    c.env?.NODE_ENV === 'production' ||
    c.env?.CF_PAGES === '1';

  if (isProduction) {
    console.error('[ERROR]', {
      status,
      detail: detailedMessage,
      timestamp: new Date().toISOString(),
      path: c.req.path,
      method: c.req.method,
    });
  }

  return c.json({ error: message }, status);
}

/**
 * 認証エラーレスポンス
 */
export function unauthorizedError(c: Context, detail?: string) {
  return errorResponse(
    c,
    401,
    detail || 'Unauthorized access',
    'Authentication required'
  );
}

/**
 * 権限エラーレスポンス
 */
export function forbiddenError(c: Context, detail?: string) {
  return errorResponse(
    c,
    403,
    detail || 'Forbidden access',
    'Insufficient permissions'
  );
}

/**
 * バリデーションエラーレスポンス
 */
export function validationError(c: Context, detail: string) {
  return errorResponse(
    c,
    400,
    detail,
    'Invalid request'
  );
}

/**
 * 内部サーバーエラーレスポンス
 */
export function serverError(c: Context, detail?: string) {
  return errorResponse(
    c,
    500,
    detail || 'Internal server error',
    'Something went wrong'
  );
}
