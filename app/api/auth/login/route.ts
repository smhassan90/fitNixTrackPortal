import { NextRequest, NextResponse } from 'next/server';

// Local user database with plain passwords (for development/testing)
const localUsers = [
  {
    id: '1',
    name: 'Touqeer Admin',
    email: 'admin@fitnix.com',
    password: 'password123', // Plain password - no hashing
    role: 'GYM_ADMIN',
    gymId: 'gym-1',
    gymName: 'FitNix Elite Gym',
  },
];

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

    // Find user by email
    const user = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Plain password comparison (no hashing)
    if (user.password !== password) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid email or password' } },
        { status: 401 }
      );
    }

    // Generate a simple token
    const token = `local_token_${Date.now()}_${user.id}`;

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
      data: {
        token,
        user: userData,
      },
    });
  } catch (error: any) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

