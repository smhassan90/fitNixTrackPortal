import { NextRequest, NextResponse } from 'next/server';

function normalizeBigInt(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => normalizeBigInt(item));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      out[k] = normalizeBigInt(v);
    });
    return out;
  }
  return value;
}

// Catch-all API route that proxies all requests to the external API
// This avoids CORS issues by making requests server-side
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(request, params.path, 'DELETE');
}

async function handleRequest(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  try {
    // Get the API URL from environment variable
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // Reconstruct the path
    const path = pathSegments.join('/');
    const isPlatformLogin = method === 'POST' && path === 'platform/auth/login';
    const externalUrl = `${apiUrl}/api/${path}`;
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${externalUrl}?${queryString}` : externalUrl;

    const incomingContentType = request.headers.get('content-type') || '';
    const isMultipart = incomingContentType.toLowerCase().includes('multipart/form-data');

    // Get request body if present (JSON or raw multipart)
    let body: BodyInit | undefined;
    if (method !== 'GET' && method !== 'DELETE') {
      if (isMultipart) {
        body = await request.arrayBuffer();
      } else {
        try {
          const json = await request.json();
          body = JSON.stringify(json);
        } catch {
          // No body or invalid JSON
        }
      }
    }

    if (isPlatformLogin) {
      let email: string | undefined;
      try {
        email =
          typeof body === 'string'
            ? (JSON.parse(body) as { email?: string })?.email
            : undefined;
      } catch {
        /* ignore */
      }
      console.info('[api-proxy] platform login request', {
        targetUrl: fullUrl,
        email,
      });
    }
    
    // Get headers from request
    const headers: HeadersInit = {};
    if (isMultipart) {
      // Preserve boundary from the client multipart request
      headers['Content-Type'] = incomingContentType;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    
    // Forward authorization header
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Forward X-Gym-Id header if present (check both cases)
    const gymIdHeader = request.headers.get('x-gym-id') || request.headers.get('X-Gym-Id');
    if (gymIdHeader) {
      headers['X-Gym-Id'] = gymIdHeader;
    }
    
    // Make request to external API
    const response = await fetch(fullUrl, {
      method,
      headers,
      body,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJsonResponse = contentType.includes('application/json');
    let data: unknown = {};
    if (isJsonResponse) {
      data = await response.json().catch(() => ({}));
    } else {
      const text = await response.text().catch(() => '');
      data = response.ok
        ? { success: true, data: text }
        : {
            success: false,
            error: {
              message: text || `Upstream API responded with ${response.status}`,
            },
          };
    }

    if (isPlatformLogin) {
      console.info('[api-proxy] platform login response', {
        targetUrl: fullUrl,
        status: response.status,
        body: data,
      });
    }
    
    // NextResponse.json cannot serialize BigInt values.
    return NextResponse.json(normalizeBigInt(data), { status: response.status });
  } catch (error: any) {
    console.error('Error proxying request to external API:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to connect to external API' } },
      { status: 503 }
    );
  }
}

