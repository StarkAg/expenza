/**
 * Tolerant HTTP helpers for the app's own `/api/*` routes.
 *
 * Call sites used to do `(await res.json()).error`. That assumes two things
 * the network never guarantees: that a body is JSON, and that it parses to an
 * object. Neither holds for an HTML error page from the edge, a plain-text
 * gateway message, an empty 502/504, or the 503 the service worker returns
 * when offline. In every one of those cases `res.json()` throws a
 * `SyntaxError` that buries the real HTTP status, and the user sees
 * "Unexpected token '<'" instead of what actually went wrong.
 *
 * Nothing here throws. Read the body as text, try to parse it, and report
 * whatever is available.
 */

export interface ApiResult<T = any> {
  /** The response's own `res.ok` -- false for a network failure too. */
  ok: boolean;
  /** HTTP status, or 0 if the request never produced a response. */
  status: number;
  /** Parsed JSON when the body was valid JSON, otherwise null. */
  data: T | null;
  /** The raw body, always a string. Empty when it could not be read. */
  text: string;
  /** Human-readable message when `ok` is false, otherwise null. */
  error: string | null;
}

const MAX_MESSAGE = 200;

/** Markup or a document is a server/proxy error page, never a user message. */
function looksLikeMarkup(text: string): boolean {
  return /^\s*(?:<|﻿<)/.test(text);
}

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE);
}

function statusMessage(status: number): string {
  if (status === 0) return 'No connection. Check your network and try again.';
  if (status === 401 || status === 403) return 'That link is no longer valid.';
  if (status === 404) return 'Not found.';
  if (status === 409) return 'That has already been handled.';
  if (status === 429) return 'Too many requests. Give it a moment.';
  if (status === 503 || status === 504) return 'The server is unreachable right now.';
  if (status >= 500) return 'Something went wrong on the server.';
  if (status >= 400) return 'That request could not be completed.';
  return 'Request failed.';
}

/**
 * Pull an error message out of whatever came back, in order of trustworthiness:
 * a JSON `error`/`message` field, then a short plain-text body, then the status.
 */
function deriveError(status: number, data: any, text: string): string {
  if (data && typeof data === 'object') {
    if (data.offline === true) return 'You are offline. This will retry when you reconnect.';
    for (const key of ['error', 'message', 'detail'] as const) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) return tidy(value);
    }
  }
  if (typeof data === 'string' && data.trim()) return tidy(data);

  // A short, non-markup body is usually a real message from a proxy or worker.
  const plain = tidy(text);
  if (plain && !looksLikeMarkup(text) && plain.length <= 120) return plain;

  return statusMessage(status);
}

/** Read a Response without ever throwing, whatever the body turns out to be. */
export async function readApiResponse<T = any>(res: Response): Promise<ApiResult<T>> {
  let text = '';
  try {
    text = await res.text();
  } catch {
    // Body already consumed, or the stream broke mid-read. Keep going: the
    // status alone is still enough to report something useful.
    text = '';
  }

  let data: T | null = null;
  if (text.trim()) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = null; // Not JSON. Expected, not exceptional.
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    text,
    error: res.ok ? null : deriveError(res.status, data, text),
  };
}

/**
 * `fetch` + `readApiResponse`, with the network rejection folded in so callers
 * get one shape for every outcome. Never throws and never rejects.
 */
export async function fetchApi<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (cause) {
    // Offline, DNS failure, or an aborted request.
    const aborted = cause instanceof DOMException && cause.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: null,
      text: '',
      error: aborted ? 'The request was cancelled.' : statusMessage(0),
    };
  }
  return readApiResponse<T>(res);
}

/** The JSON object from a successful response, or `{}` if it was not an object. */
export function objectOf<T extends Record<string, any>>(result: ApiResult<T>): Partial<T> {
  const { data } = result;
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}
