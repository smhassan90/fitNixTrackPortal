import { NextRequest, NextResponse } from 'next/server';

// Local user database
const localUsers = [
  {
    id: '1',
    name: 'Touqeer Admin',
    email: 'admin@fitnix.com',
    password: 'password123',
    role: 'GYM_ADMIN',
    gymId: 'gym-1',
    gymName: 'FitNix Elite Gym',
  },
];

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    // Check if token is JWT (from external API) - starts with 'eyJ'
    if (token.startsWith('eyJ')) {
      // Forward JWT token to external API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const externalUrl = `${apiUrl}/api/auth/me`;
      
      console.log('🔵 Forwarding /api/auth/me to external API for JWT token');
      
      try {
        const response = await fetch(externalUrl, {
          method: 'GET',
          headers: {
            'Authorization': authHeader || '',
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json().catch(() => ({}));
        return NextResponse.json(data, { status: response.status });
      } catch (fetchError: any) {
        console.error('Error forwarding to external API:', fetchError);
        return NextResponse.json(
          { success: false, error: { message: 'Failed to connect to external API' } },
          { status: 503 }
        );
      }
    }

    // Local token validation (for local tokens)
    // Extract user ID from token (simple token format: local_token_timestamp_userId)
    const tokenParts = token.split('_');
    if (tokenParts.length < 3 || tokenParts[0] !== 'local' || tokenParts[1] !== 'token') {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid token' } },
        { status: 401 }
      );
    }

    const userId = tokenParts[tokenParts.length - 1];
    const user = localUsers.find(u => u.id === userId);

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'User not found' } },
        { status: 401 }
      );
    }

    // Return user data (without password)
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      gymId: user.gymId,
      gymName: user.gymName,
    };

    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch (error: any) {
    console.error('Me API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

