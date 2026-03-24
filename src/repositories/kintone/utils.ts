/**
 * Kintone API エラーレスポンスを解析して日本語のエラーメッセージを返す
 */
export async function parseKintoneError(
  response: Response,
  defaultMessage: string
): Promise<string> {
  let errorMessage = `${defaultMessage}: ${response.status}`;
  try {
    const errorData = await response.json();
    if (errorData.message) {
      errorMessage = errorData.message;
      if (errorMessage.includes('Kintone API error')) {
        const kintoneErrorMatch = errorMessage.match(
          /Kintone API error: (\d+) (.+?) - (.+)/
        );
        if (kintoneErrorMatch) {
          const [, status, statusText, errorJson] = kintoneErrorMatch;
          try {
            const kintoneError = JSON.parse(errorJson);
            if (kintoneError.message) {
              errorMessage = `Kintone APIエラー: ${kintoneError.message}`;
            } else {
              errorMessage = `Kintone APIエラー (${status}): ${statusText}`;
            }
          } catch {
            errorMessage = `Kintone APIエラー (${status}): ${statusText}`;
          }
        }
      }
    } else if (errorData.error) {
      errorMessage += ` - ${errorData.error}`;
    }
  } catch {
    if (response.statusText) {
      errorMessage += ` ${response.statusText}`;
    }
  }
  return errorMessage;
}

/**
 * 401 エラー時にトークンを削除して認証エラーをスロー
 */
export function handleUnauthorized(): never {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
  throw new Error('認証に失敗しました');
}
