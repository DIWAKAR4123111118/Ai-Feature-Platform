const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

const DEV_EMAIL = process.env.NEXT_PUBLIC_DEV_EMAIL || '';
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD || '';

let cachedToken: string | null = null;
let tokenPromise: Promise<string> | null = null;

async function loginDevUser(): Promise<string> {
  if (!DEV_EMAIL || !DEV_PASSWORD) {
    throw new Error('DEV_EMAIL or DEV_PASSWORD not configured');
  }

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to login dev user: ${res.status} ${text}`);
  }

  const data = await res.json();

  if (!data.token || typeof data.token !== 'string') {
    throw new Error('Login response missing token');
  }

  return data.token;
}

export async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (!tokenPromise) {
    tokenPromise = loginDevUser().then((token) => {
      cachedToken = token;
      return token;
    });
  }

  return tokenPromise;
}