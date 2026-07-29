const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getInitData(): string {
  return (window as any).Telegram?.WebApp?.initData ?? '';
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `tma ${getInitData()}`,
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ApiError(response.status, (body as { error?: string })?.error ?? 'Request failed');
  }
  return body as T;
}
