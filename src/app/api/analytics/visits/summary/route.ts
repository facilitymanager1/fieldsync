import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock visits data - replace with real database queries
    const mockVisitsData = {
      scheduled: 45,
      completed: 32,
      pending: 13,
      completionRate: Math.round((32 / 45) * 100),
      trends: {
        weeklyChange: 12,
        monthlyChange: 8
      },
      breakdown: [
        { status: 'completed', count: 32 },
        { status: 'in_progress', count: 8 },
        { status: 'pending', count: 5 }
      ]
    };

    return NextResponse.json({
      success: true,
      data: mockVisitsData
    });
  } catch (error) {
    console.error('Error getting visits summary:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve visits summary' 
      },
      { status: 500 }
    );
  }
}