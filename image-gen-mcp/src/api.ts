const USEAPI_BASE = 'https://api.useapi.net/v1/google-flow';

const ERROR_MAP: Record<number, string> = {
  400: 'Bad request. Check your parameters.',
  401: 'Invalid API token. Check your USEAPI_TOKEN environment variable.',
  402: 'useapi.net subscription expired. Renew at useapi.net.',
  403: 'reCAPTCHA challenge failed. Try again.',
  404: 'Account not found. Register a Google account first.',
  429: 'Rate limit exceeded. Wait a moment and try again.',
  500: 'Content was blocked by moderation. Try a different prompt.',
  503: 'Service temporarily unavailable. Try again later.',
  596: 'Google session expired. Re-register your Google account cookies.',
};

function getToken(): string {
  const token = process.env.USEAPI_TOKEN;
  if (!token) throw new Error('USEAPI_TOKEN environment variable is not set.');
  return token;
}

function authHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,
  };
  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

async function parseError(res: Response): Promise<string> {
  let detail = '';
  try {
    const data = await res.json();
    const errorObj = data?.error;
    if (typeof errorObj === 'string') {
      detail = errorObj;
    } else if (typeof errorObj === 'object' && errorObj !== null) {
      const reason = errorObj.reason || '';
      detail = errorObj.message || '';
      if (reason) detail = `${detail} [${reason}]`;
    }
    if (!detail) detail = data?.message || data?.detail || '';
  } catch {
    try { detail = await res.text(); } catch {}
  }
  return detail || ERROR_MAP[res.status] || `Request failed (${res.status})`;
}

export async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${USEAPI_BASE}${path}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiPost(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${USEAPI_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiPostBinary(path: string, buffer: Buffer, mimeType: string): Promise<unknown> {
  const res = await fetch(`${USEAPI_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(mimeType),
    body: new Uint8Array(buffer),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiDelete(path: string): Promise<unknown> {
  const res = await fetch(`${USEAPI_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
