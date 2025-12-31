import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { message: 'Email and password are required' } },
        { status: 400 }
      );
    }

    // Forward request to external API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const externalUrl = `${apiUrl}/api/auth/login`;

    try {
      const response = await fetch(externalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Forward error response from external API
        return NextResponse.json(
          data,
          { status: response.status }
        );
      }

      // Forward successful response from external API
      return NextResponse.json(data, { status: response.status });
    } catch (fetchError: any) {
      console.error('Error forwarding request to external API:', fetchError);
      return NextResponse.json(
        { success: false, error: { message: 'Failed to connect to external API' } },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

