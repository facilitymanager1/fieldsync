import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock expenses data - replace with real database queries
    const mockExpensesData = {
      pending: 8,
      thisMonth: 12450,
      lastMonth: 11200,
      approved: 15,
      rejected: 2,
      trends: {
        weeklyChange: -3,
        monthlyChange: 15
      },
      categories: [
        { category: 'Travel', amount: 4200 },
        { category: 'Equipment', amount: 3150 },
        { category: 'Meals', amount: 2100 },
        { category: 'Other', amount: 3000 }
      ]
    };

    return NextResponse.json({
      success: true,
      data: mockExpensesData
    });
  } catch (error) {
    console.error('Error getting expenses summary:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve expenses summary' 
      },
      { status: 500 }
    );
  }
}