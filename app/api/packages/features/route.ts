import { NextRequest, NextResponse } from 'next/server';

// GET /api/packages/features - Get all features from external API
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 }
      );
    }

    // Forward request to external API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const externalUrl = `${apiUrl}/api/packages/features`;

    try {
      const response = await fetch(externalUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { success: false, error: errorData.error || { message: 'Failed to fetch features from external API' } },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError: any) {
      console.error('Error forwarding request to external API:', fetchError);
      return NextResponse.json(
        { success: false, error: { message: 'Failed to connect to external API' } },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error('Get features API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

