import { NextRequest, NextResponse } from 'next/server';

function proxyHeaders(request: NextRequest): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  const authHeader = request.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;
  const gymId = request.headers.get('x-gym-id') || request.headers.get('X-Gym-Id');
  if (gymId) headers['X-Gym-Id'] = gymId;
  return headers;
}

type RouteContext = { params: { id: string } };

// PATCH /api/packages/features/:id
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 }
      );
    }

    const id = encodeURIComponent(params.id);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const externalUrl = `${apiUrl}/api/packages/features/${id}`;
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    try {
      const response = await fetch(externalUrl, {
        method: 'PATCH',
        headers: proxyHeaders(request),
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    } catch (fetchError: unknown) {
      console.error('Error forwarding update feature to external API:', fetchError);
      return NextResponse.json(
        { success: false, error: { message: 'Failed to connect to external API' } },
        { status: 503 }
      );
    }
  } catch (error: unknown) {
    console.error('Update feature API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// DELETE /api/packages/features/:id (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 }
      );
    }

    const id = encodeURIComponent(params.id);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const externalUrl = `${apiUrl}/api/packages/features/${id}`;

    try {
      const response = await fetch(externalUrl, {
        method: 'DELETE',
        headers: proxyHeaders(request),
      });
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    } catch (fetchError: unknown) {
      console.error('Error forwarding delete feature to external API:', fetchError);
      return NextResponse.json(
        { success: false, error: { message: 'Failed to connect to external API' } },
        { status: 503 }
      );
    }
  } catch (error: unknown) {
    console.error('Delete feature API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
