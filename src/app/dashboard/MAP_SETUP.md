# 🗺️ Interactive Map Component Setup

## Overview
The Interactive Map component provides real-time field staff tracking with the following features:

- **Real-time Staff Locations**: View live positions of all field personnel
- **Status Indicators**: Color-coded markers showing staff status (active, break, transit, offline)
- **Geofence Boundaries**: Visual representation of work sites and restricted zones
- **Interactive Info Windows**: Click staff markers to see detailed information
- **Route Optimization**: Ready for future implementation of optimal routing
- **Mobile-Responsive Controls**: Filter, search, and navigation controls

## Quick Start

### 1. Demo Mode (Current Setup)
The map is currently running in demo mode with mock data. No API key required to see the interface and test functionality.

### 2. Production Setup

#### Step 1: Get Google Maps API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Create credentials → API Key
5. Restrict the API key to your domains

#### Step 2: Configure Environment Variables
Update your `.env.local` file:
```bash
# Replace with your actual API key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

#### Step 3: Restart Development Server
```bash
npm run dev
```

## Features

### 🎯 Staff Tracking
- **Live Positions**: Real-time GPS coordinates from mobile devices
- **Status Updates**: Automatic status detection (active, break, transit)
- **Vehicle Tracking**: Associate staff with vehicles for fleet management
- **Last Seen**: Timestamp of most recent location update

### 🔧 Interactive Controls
- **Filter by Status**: Show only active, break, transit, or offline staff
- **Center on Location**: Quick navigation to user's current position
- **Fit All Staff**: Auto-zoom to show all team members
- **Toggle Geofences**: Show/hide work site boundaries

### 📍 Geofence Management
- **Work Sites**: Mark important locations with custom boundaries
- **Restricted Areas**: Define no-go zones for safety compliance
- **Client Sites**: Mark customer locations for easy reference
- **Custom Radius**: Adjustable boundary sizes per location

### 💡 Smart Info Windows
- **Staff Details**: Name, current task, vehicle assignment
- **Status Indicators**: Visual status with appropriate icons
- **Time Stamps**: Last update time for location accuracy
- **Quick Actions**: Direct links to contact or assign tasks

## Integration with FieldSync

### Data Sources
The map component is designed to integrate with:
- **Real-time Location API**: GPS coordinates from mobile devices
- **Staff Management System**: Current assignments and status
- **Geofence Service**: Site boundaries and restricted areas
- **Vehicle Tracking**: Fleet management integration

### API Endpoints (Future Implementation)
```typescript
// Example API calls for live data
const staffLocations = await fetch('/api/staff/locations');
const geofences = await fetch('/api/geofences');
const vehicles = await fetch('/api/vehicles/active');
```

### WebSocket Updates
For real-time updates without page refresh:
```typescript
// Example WebSocket integration
const socket = io('/maps');
socket.on('location_update', (data) => {
  updateStaffPosition(data.staffId, data.coordinates);
});
```

## Customization

### Map Styling
Customize the map appearance in `InteractiveMap.tsx`:
```typescript
const mapStyles = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  }
  // Add more custom styles
];
```

### Status Colors
Modify status colors to match your brand:
```typescript
const getStatusColor = (status: string) => {
  switch (status) {
    case 'active': return '#4caf50';    // Green
    case 'break': return '#ff9800';     // Orange
    case 'transit': return '#2196f3';   // Blue
    case 'offline': return '#f44336';   // Red
  }
};
```

### Custom Markers
Add custom marker icons:
```typescript
const customMarker = {
  url: '/icons/staff-marker.png',
  scaledSize: new google.maps.Size(40, 40),
  origin: new google.maps.Point(0, 0),
  anchor: new google.maps.Point(20, 40)
};
```

## Mobile Optimization

The map component is fully responsive and optimized for mobile field workers:

- **Touch-Friendly**: Large tap targets for finger navigation
- **Performance**: Optimized rendering for mobile devices
- **Offline Fallback**: Graceful degradation when connectivity is poor
- **Battery Efficient**: Smart update intervals to preserve battery life

## Security & Privacy

### API Key Security
- **Domain Restrictions**: Limit API key usage to your domains
- **Environment Variables**: Never commit API keys to version control
- **Rate Limiting**: Implement usage quotas to prevent abuse

### Location Privacy
- **Opt-in Tracking**: Staff must consent to location sharing
- **Data Retention**: Automatic cleanup of old location data
- **Access Control**: Role-based access to location information

## Troubleshooting

### Common Issues

**Map Not Loading:**
1. Check API key configuration
2. Verify internet connectivity
3. Check browser console for errors

**Missing Staff Markers:**
1. Verify API endpoint is returning data
2. Check coordinate format (lat/lng)
3. Ensure status values match expected enum

**Performance Issues:**
1. Implement marker clustering for large teams
2. Add debouncing for real-time updates
3. Use viewport-based filtering

### Debug Mode
Enable debug logging:
```typescript
const DEBUG_MODE = process.env.NODE_ENV === 'development';
if (DEBUG_MODE) {
  console.log('Staff locations:', staffLocations);
}
```

## Future Enhancements

### Planned Features
- **Route Optimization**: AI-powered route planning
- **Predictive Analytics**: Forecast optimal staff deployment
- **Heatmaps**: Visual representation of activity density
- **Time Machine**: Replay staff movements over time
- **Clustering**: Automatic marker grouping for large teams
- **Offline Maps**: Download areas for offline use

### Integration Opportunities
- **Weather Overlay**: Show weather conditions affecting field work
- **Traffic Data**: Real-time traffic information for route planning
- **Customer Locations**: Integration with CRM for customer sites
- **IoT Sensors**: Display data from connected field equipment

## Support

For technical support or feature requests:
- 📧 Email: support@fieldsync.com
- 📱 Mobile: Use in-app feedback
- 💬 Slack: #fieldsync-support
- 📖 Documentation: [docs.fieldsync.com](https://docs.fieldsync.com)

---

**Last Updated**: August 2025  
**Version**: 1.0.0  
**Component**: InteractiveMap.tsx
