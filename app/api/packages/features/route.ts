import { NextRequest, NextResponse } from 'next/server';

// Local features database (sorted alphabetically)
// In production, this would be replaced with a database query
const features = [
  {
    id: 1,
    name: 'Free Supplements',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Group Classes',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 3,
    name: 'Gym Access',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 4,
    name: 'Locker',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 5,
    name: 'Nutrition Plan',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 6,
    name: 'Personal Trainer',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 7,
    name: 'Shower',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 8,
    name: 'Spa Access',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 9,
    name: 'Locker Facility',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 10,
    name: 'Sauna Access',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 11,
    name: 'Personal Training Session',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 12,
    name: 'Nutrition Consultation',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 13,
    name: 'Cardio Equipment',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 14,
    name: 'Weight Training Equipment',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 15,
    name: 'Swimming Pool',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 16,
    name: 'Yoga Classes',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 17,
    name: 'Zumba Classes',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 18,
    name: 'Steam Room',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 19,
    name: 'Towel Service',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 20,
    name: 'Parking Facility',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 21,
    name: '24/7 Access',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

// Helper function to verify authentication
function isAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    console.log('No token provided');
    return false;
  }
  
  // Extract user ID from token (simple token format: local_token_timestamp_userId)
  const tokenParts = token.split('_');
  
  // Check if it's a local token
  if (tokenParts.length >= 3 && tokenParts[0] === 'local' && tokenParts[1] === 'token') {
    console.log('Valid local token format');
    return true;
  }
  
  // For external API tokens, accept any non-empty token
  // In production, verify token with database
  if (token && token.length > 0) {
    console.log('Token provided (external format)');
    return true;
  }
  
  console.log('Invalid token format');
  return false;
}

// GET /api/packages/features - Get all features
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 }
      );
    }

    // Sort features alphabetically by name
    const sortedFeatures = [...features].sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({
      success: true,
      data: {
        features: sortedFeatures,
      },
    });
  } catch (error: any) {
    console.error('Get features API error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}

