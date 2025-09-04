# FieldSync Kiosk Mode - Deployment Guide

## Overview

FieldSync Kiosk Mode provides a dedicated interface for geolocation-based attendance capture at fixed locations. This system allows employees to check in/out using face recognition and geofencing validation without requiring personal devices or logins.

## System Architecture

### Frontend Components
- **Kiosk Interface** (`/src/app/kiosk/page.tsx`) - Main attendance capture interface
- **Kiosk Layout** (`/src/app/kiosk/layout.tsx`) - Full-screen kiosk-optimized layout
- **Configuration Panel** (`/src/app/kiosk/config/page.tsx`) - Admin interface for setup

### Backend Components
- **Kiosk Routes** (`/backend/routes/kioskRoutes.ts`) - API endpoints for all kiosk operations
- **Kiosk Models** (`/backend/models/kiosk.ts`) - Database schemas and validation
- **Kiosk Service** (`/backend/modules/kioskService.ts`) - Business logic and geofencing

## Quick Start Deployment

### 1. Hardware Requirements

**Minimum Specifications:**
- Tablet/Kiosk Device: 10" screen minimum, touch-enabled
- Camera: Front-facing camera for face recognition
- Network: Stable Wi-Fi or ethernet connection
- Browser: Chrome 90+, Firefox 88+, Safari 14+

**Recommended Setup:**
- Dedicated kiosk tablet or all-in-one device
- Wall-mounted or desktop stand
- Power adapter with long cable
- Optional: External webcam for better image quality

### 2. Software Setup

**Step 1: Configure Location**
```bash
# Access admin configuration panel
http://your-domain.com/kiosk/config

# Create new kiosk location with:
# - Location name and address
# - GPS coordinates (use built-in location finder)
# - Geofence radius (recommended: 50-200 meters)
# - Assigned employees list
# - Display settings and welcome message
```

**Step 2: Employee Enrollment**
```bash
# For each employee:
# 1. Add to assigned employees list for the location
# 2. Capture face recognition data using admin panel
# 3. Test face recognition accuracy
# 4. Configure attendance permissions
```

**Step 3: Kiosk Device Setup**
```bash
# Configure browser for kiosk mode:
# Chrome: --kiosk --disable-web-security --disable-features=TranslateUI
# Firefox: Full-screen mode (F11) + disable address bar
# Safari: Guided Access mode on iPad

# Set homepage to:
http://your-domain.com/kiosk
```

### 3. Location Configuration

**Geofencing Setup:**
- Use GPS coordinates for precise location tracking
- Set appropriate radius (50m for office buildings, 200m for outdoor sites)
- Test geofence accuracy with multiple devices
- Configure backup location methods if GPS is unreliable

**Face Recognition Configuration:**
- Minimum 3 face samples per employee for accuracy
- Capture samples in different lighting conditions
- Set confidence threshold (recommended: 0.7-0.8)
- Enable liveness detection to prevent photo spoofing

## Operational Features

### Attendance Capture
- **Single Employee Check-in**: Individual face recognition and GPS validation
- **Group Check-in**: Multiple employees simultaneously (up to 10 people)
- **Manual Override**: Admin PIN for when automatic systems fail
- **Offline Mode**: Local storage when network is unavailable

### Security Features
- **Geofence Validation**: Ensures attendance only at designated locations
- **Face Recognition**: Prevents buddy punching and unauthorized access
- **Audit Logging**: Complete trail of all attendance events
- **Security Flagging**: Automatic alerts for suspicious activity

### Administrative Controls
- **Real-time Monitoring**: Live dashboard of attendance activity
- **Location Management**: Add/edit/disable kiosk locations
- **Employee Assignment**: Control which employees can use each kiosk
- **Settings Override**: Remote configuration changes

## API Endpoints

### Attendance Operations
```typescript
// Record attendance
POST /api/kiosk/attendance
{
  locationId: string,
  employees: [{
    employeeId: string,
    faceData?: string,
    coordinates: { latitude: number, longitude: number }
  }],
  type: 'check-in' | 'check-out',
  groupSessionId?: string
}

// Get attendance records
GET /api/kiosk/attendance?locationId=xxx&date=yyyy-mm-dd

// Validate location access
POST /api/kiosk/validate-location
{
  locationId: string,
  coordinates: { latitude: number, longitude: number }
}
```

### Location Management
```typescript
// Create/update location
POST /api/kiosk/locations
PUT /api/kiosk/locations/:id
{
  name: string,
  address: string,
  coordinates: { latitude: number, longitude: number },
  geofenceRadius: number,
  settings: { ... }
}

// Get locations
GET /api/kiosk/locations
GET /api/kiosk/locations/:id
```

### Analytics and Monitoring
```typescript
// Get analytics
GET /api/kiosk/analytics/:locationId?period=daily|weekly|monthly

// Health monitoring
GET /api/kiosk/health/:locationId
```

## Troubleshooting

### Common Issues

**Face Recognition Not Working:**
1. Check camera permissions in browser
2. Ensure adequate lighting at kiosk location
3. Re-enroll employee face data with better samples
4. Verify face recognition service is running

**Geofencing Failures:**
1. Check GPS signal strength and accuracy
2. Verify location coordinates are correct
3. Adjust geofence radius if too restrictive
4. Enable location services in browser settings

**Network Connectivity:**
1. Test internet connection stability
2. Configure offline mode for backup
3. Check firewall settings for API access
4. Verify SSL certificates for HTTPS

**Performance Issues:**
1. Clear browser cache and restart
2. Check available storage space
3. Update browser to latest version
4. Restart kiosk device daily

### Support and Maintenance

**Daily Maintenance:**
- Check kiosk device functionality
- Verify attendance records are syncing
- Clean camera lens and screen
- Monitor battery levels if applicable

**Weekly Maintenance:**
- Review attendance analytics for anomalies
- Update employee assignments as needed
- Check system health reports
- Backup configuration settings

**Monthly Maintenance:**
- Update browser and system software
- Review and archive old attendance data
- Test emergency procedures and manual overrides
- Audit security logs for suspicious activity

## Integration with FieldSync

The kiosk mode integrates seamlessly with the main FieldSync application:

- **Shared Employee Database**: Uses existing staff records
- **Unified Analytics**: Attendance data flows into main dashboards
- **Role-Based Access**: Inherits user permissions and security
- **Audit Trail**: All kiosk activity logged in central audit system

## Security Considerations

**Physical Security:**
- Secure mounting to prevent theft or tampering
- Lock down device settings and prevent unauthorized access
- Regular firmware updates for security patches

**Data Security:**
- All face recognition data encrypted in transit and at rest
- GPS coordinates logged with employee consent
- Compliance with local privacy regulations (GDPR, CCPA, etc.)
- Regular security audits and penetration testing

**Access Control:**
- Admin access protected with multi-factor authentication
- Employee data access limited to assigned locations only
- Automatic session timeouts and device locking

## Compliance and Privacy

**Data Protection:**
- Face recognition data stored securely with encryption
- Employee consent required for biometric data collection
- Right to deletion and data portability supported
- Regular data retention policy enforcement

**Regulatory Compliance:**
- GDPR compliance for EU deployments
- CCPA compliance for California locations
- Industry-specific regulations (HIPAA, SOX, etc.)
- Regular compliance audits and reporting

**Best Practices:**
- Minimal data collection principle
- Transparent privacy policies
- Employee training on privacy rights
- Regular review of data handling procedures

## Scaling and Enterprise Deployment

**Multi-Location Support:**
- Centralized management of multiple kiosk locations
- Location-specific settings and employee assignments
- Hierarchical reporting and analytics
- Automated failover and backup procedures

**Enterprise Integration:**
- Single Sign-On (SSO) integration
- LDAP/Active Directory synchronization
- API integration with existing HR systems
- Custom branding and white-label options

**Performance Optimization:**
- Load balancing for high-traffic locations
- Caching strategies for offline operation
- Database optimization for large employee counts
- Real-time monitoring and alerting

This comprehensive kiosk mode solution provides a robust, secure, and scalable attendance capture system that integrates seamlessly with the FieldSync platform while maintaining the highest standards of security and user experience.
