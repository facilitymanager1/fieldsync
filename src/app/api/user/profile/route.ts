import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Mock user profile data - replace with database integration
    const mockProfile = {
      id: '1',
      name: 'Alex Johnson',
      email: 'alex.johnson@fieldsync.com',
      role: 'Field Technician',
      department: 'Field Operations',
      phone: '+1 (555) 123-4567',
      avatar: null,
      lastLogin: new Date().toISOString(),
      isActive: true
    };

    return NextResponse.json({
      success: true,
      data: mockProfile
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve user profile' 
      },
      { status: 500 }
    );
  }
}