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

// GET /api/packages/[id] - Get single package
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const packageItem = packages.find(p => p.id === id);

    if (!packageItem) {
      return NextResponse.json(
        { success: false, error: { message: 'Package not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        package: packageItem,
      },
    });
  } catch (error: any) {
    console.error('Get package API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// PUT /api/packages/[id] - Update package (Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user is admin
    if (!isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized. Admin access required.' } },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { name, price, duration, features } = body;

    // Find package
    const packageIndex = packages.findIndex(p => p.id === id);
    if (packageIndex === -1) {
      return NextResponse.json(
        { success: false, error: { message: 'Package not found' } },
        { status: 404 }
      );
    }

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

    // Update package
    packages[packageIndex] = {
      ...packages[packageIndex],
      name: name.trim(),
      price: typeof price === 'string' ? parseFloat(price) : price,
      duration: duration.trim(),
      features: features.map((f: string) => f.trim()).filter((f: string) => f.length > 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        package: packages[packageIndex],
      },
    });
  } catch (error: any) {
    console.error('Update package API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

// DELETE /api/packages/[id] - Delete package (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if user is admin
    if (!isAdmin(request)) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized. Admin access required.' } },
        { status: 403 }
      );
    }

    const { id } = params;
    const packageIndex = packages.findIndex(p => p.id === id);

    if (packageIndex === -1) {
      return NextResponse.json(
        { success: false, error: { message: 'Package not found' } },
        { status: 404 }
      );
    }

    // Delete package
    const deletedPackage = packages.splice(packageIndex, 1)[0];

    return NextResponse.json({
      success: true,
      data: {
        message: 'Package deleted successfully',
        package: deletedPackage,
      },
    });
  } catch (error: any) {
    console.error('Delete package API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

