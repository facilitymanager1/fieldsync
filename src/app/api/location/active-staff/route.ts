import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock location data - replace with real database queries and GPS tracking
    const mockLocationData = {
      activeStaff: 18,
      locations: [
        { 
          id: 1, 
          name: 'John Smith', 
          lat: 40.7128, 
          lng: -74.0060, 
          status: 'active',
          lastUpdate: new Date().toISOString(),
          accuracy: 10
        },
        { 
          id: 2, 
          name: 'Sarah Wilson', 
          lat: 40.7589, 
          lng: -73.9851, 
          status: 'transit',
          lastUpdate: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
          accuracy: 15
        },
        { 
          id: 3, 
          name: 'Mike Johnson', 
          lat: 40.6892, 
          lng: -74.0445, 
          status: 'break',
          lastUpdate: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          accuracy: 8
        },
        { 
          id: 4, 
          name: 'Lisa Chen', 
          lat: 40.7505, 
          lng: -73.9934, 
          status: 'active',
          lastUpdate: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
          accuracy: 12
        },
        { 
          id: 5, 
          name: 'David Brown', 
          lat: 40.7282, 
          lng: -74.0776, 
          status: 'active',
          lastUpdate: new Date().toISOString(),
          accuracy: 6
        }
      ],
      summary: {
        active: 12,
        onBreak: 3,
        transit: 3,
        offline: 12
      }
    };

    return NextResponse.json({
      success: true,
      data: mockLocationData
    });
  } catch (error) {
    console.error('Error getting active staff locations:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve active staff locations' 
      },
      { status: 500 }
    );
  }
}