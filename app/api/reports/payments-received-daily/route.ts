import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxies to the gym API for daily collection totals. If the backend has not
 * implemented the route yet, returns a structured response so the Reports UI
 * can show a friendly message instead of failing.
 */
export async function GET(request: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const queryString = request.nextUrl.searchParams.toString();
  const qs = queryString ? `?${queryString}` : '';

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const authHeader = request.headers.get('authorization');
  if (authHeader) headers.Authorization = authHeader;
  const gymIdHeader = request.headers.get('x-gym-id') || request.headers.get('X-Gym-Id');
  if (gymIdHeader) headers['X-Gym-Id'] = gymIdHeader;

  const paths = ['reports/payments-received-daily', 'dashboard/payments-received-daily', 'payments/received-daily'];

  for (const path of paths) {
    const externalUrl = `${apiUrl}/api/${path}${qs}`;
    try {
      const response = await fetch(externalUrl, { method: 'GET', headers });
      if (!response.ok) continue;
      const data = await response.json().catch(() => null);
      if (data && data.success === true && data.data != null && typeof data.data === 'object') {
        return NextResponse.json(data);
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      availability: 'backend_not_configured',
      days: [],
    },
  });
}
