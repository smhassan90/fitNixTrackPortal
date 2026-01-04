import { NextRequest, NextResponse } from 'next/server';
import { packages } from '@/lib/packagesData';

// Local user database (same as auth/me route)
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

// Helper function to verify admin role
function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) return false;
  
  // Extract user ID from token (simple token format: local_token_timestamp_userId)
  const tokenParts = token.split('_');
  if (tokenParts.length < 3 || tokenParts[0] !== 'local' || tokenParts[1] !== 'token') {
    return false;
  }
  
  const userId = tokenParts[tokenParts.length - 1];
  const user = localUsers.find(u => u.id === userId);
  
  // Check if user exists and has admin role
  return user?.role === 'GYM_ADMIN';
}

// GET /api/packages - List all packages
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Check if token is a JWT (starts with eyJ) - if so, forward to external API
    if (token && token.startsWith('eyJ')) {
      // Forward to external API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const { searchParams } = new URL(request.url);
      const queryString = searchParams.toString();
      const externalUrl = `${apiUrl}/api/packages${queryString ? `?${queryString}` : ''}`;
      
      console.log(`🔵 Forwarding GET /api/packages to external API`);
      
      const response = await fetch(externalUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || '',
        },
      });
      
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    }
    
    // Otherwise, use local logic for local tokens
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '1000');

    let sortedPackages = [...packages];

    // Sort packages
    sortedPackages.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'duration':
          const aNum = parseInt(a.duration) || 0;
          const bNum = parseInt(b.duration) || 0;
          aValue = aNum;
          bValue = bNum;
          break;
        case 'features':
          aValue = a.features.length;
          bValue = b.features.length;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Apply limit
    const limitedPackages = sortedPackages.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        packages: limitedPackages,
        total: packages.length,
      },
    });
  } catch (error: any) {
    console.error('Get packages API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// POST /api/packages - Create new package (Admin only)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Check if token is a JWT (starts with eyJ) - if so, forward to external API
    if (token && token.startsWith('eyJ')) {
      // Forward to external API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const externalUrl = `${apiUrl}/api/packages`;
      
      const body = await request.json();
      
      console.log(`🔵 Forwarding POST /api/packages to external API`);
      
      const response = await fetch(externalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader || '',
        },
        body: JSON.stringify(body),
      });
      
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status });
    }
    
    // Otherwise, use local logic for local tokens
    // Check if user is admin
    if (!isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized. Admin access required.' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, price, duration, features } = body;

    // Validation
    if (!name || !price || !duration || !features || !Array.isArray(features) || features.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Name, price, duration, and at least one feature are required' } },
        { status: 400 }
      );
    }

    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json(
        { success: false, error: { message: 'Price must be a positive number' } },
        { status: 400 }
      );
    }

    // Create new package
    const newPackage = {
      id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      price: typeof price === 'string' ? parseFloat(price) : price,
      duration: duration.trim(),
      features: features.map((f: string) => f.trim()).filter((f: string) => f.length > 0),
    };

    packages.push(newPackage);

    return NextResponse.json({
      success: true,
      data: {
        package: newPackage,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create package API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

