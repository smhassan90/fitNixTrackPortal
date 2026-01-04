import { NextRequest, NextResponse } from 'next/server';

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
    const externalUrl = `${apiUrl}/api/${path}`;
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const fullUrl = queryString ? `${externalUrl}?${queryString}` : externalUrl;
    
    console.log(`🔵 Proxying ${method} request to:`, fullUrl);
    
    // Get request body if present
    let body = null;
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        body = await request.json();
      } catch {
        // No body or invalid JSON
      }
    }
    
    // Get headers from request
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
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
      body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json().catch(() => ({}));
    
    // Forward the response
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error proxying request to external API:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to connect to external API' } },
      { status: 503 }
    );
  }
}

