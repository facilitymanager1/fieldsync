import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    // Mock activities data - replace with real database queries
    const mockActivities = [
      { 
        id: 1, 
        type: 'checkin', 
        user: 'John Smith', 
        location: 'Downtown Office', 
        time: '5 minutes ago',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      },
      { 
        id: 2, 
        type: 'visit', 
        user: 'Sarah Wilson', 
        location: 'Client Site A', 
        time: '12 minutes ago',
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString()
      },
      { 
        id: 3, 
        type: 'expense', 
        user: 'Mike Johnson', 
        amount: '$250', 
        time: '25 minutes ago',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString()
      },
      { 
        id: 4, 
        type: 'ticket', 
        user: 'Lisa Chen', 
        issue: 'Equipment malfunction', 
        time: '1 hour ago',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString()
      },
      { 
        id: 5, 
        type: 'checkin', 
        user: 'David Brown', 
        location: 'Warehouse B', 
        time: '1.5 hours ago',
        timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString()
      },
      { 
        id: 6, 
        type: 'visit', 
        user: 'Emma Davis', 
        location: 'Manufacturing Plant', 
        time: '2 hours ago',
        timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString()
      }
    ];

    const limitedActivities = mockActivities.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        activities: limitedActivities,
        total: mockActivities.length,
        limit
      }
    });
  } catch (error) {
    console.error('Error getting activities feed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve activities feed' 
      },
      { status: 500 }
    );
  }
}