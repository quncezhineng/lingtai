/**
 * Read an API response without assuming every route answers with JSON.
 * Plain-text 404s, proxy HTML pages and empty bodies must not surface as
 * "Unexpected token" parse errors in the UI.
 */
export async function readApiPayload<T>(response: Response, fallback?: string): Promise<T> {
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = undefined;
  }
  if (!response.ok) {
    const error =
      payload && typeof payload === "object" ? (payload as { error?: unknown }).error : undefined;
    const message =
      typeof error === "string" ? error : (fallback ?? `Request failed (${response.status})`);
    // 附上 HTTP 状态码，方便上层识别 401（令牌过期）并引导用户重新登录。
    const failure = new Error(message) as Error & { status?: number };
    failure.status = response.status;
    throw failure;
  }
  if (payload === undefined)
    throw new Error(`The server returned an unreadable response (${response.status}).`);
  return payload as T;
}
