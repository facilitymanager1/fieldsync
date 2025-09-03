import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock attendance data - replace with real database queries
    const mockAttendanceData = {
      checkedIn: 23,
      total: 30,
      percentage: Math.round((23 / 30) * 100),
      anomalies: 2,
      trends: {
        weeklyChange: 5,
        monthlyChange: 12
      },
      breakdown: [
        { status: 'checked_in', count: 23 },
        { status: 'on_break', count: 3 },
        { status: 'not_checked_in', count: 4 }
      ]
    };

    return NextResponse.json({
      success: true,
      data: mockAttendanceData
    });
  } catch (error) {
    console.error('Error getting attendance summary:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve attendance summary' 
      },
      { status: 500 }
    );
  }
}