# FieldSync Mobile App

This is the React Native mobile app for the Field-Staff Management Platform. It is structured to support all business modules described in AGENT.md.

## Structure
- `modules/` — Feature modules (attendance, geofence, odometer, etc.)
- `components/` — Shared UI components
- `navigation/` — Navigation setup
- `services/` — API, storage, analytics, etc.
- `utils/` — Utility functions

## Getting Started
1. Install dependencies: `npm install`
2. Start Metro: `npx react-native start`
3. Run on device: `npx react-native run-android` or `npx react-native run-ios`

## Modules to Implement
- Authentication & Security
- Geofence & Location
- Shift State Machine
- Passive Location
- Odometer & Photo Verification
- Sync & Reconciliation
- Service Reporting
- Planner
- Analytics
- Storage & Encryption
- Feature Flags
- Ticket Desk
- Meeting Minutes
- SLA Engine
- Replacement Duty
- Facial Recognition
- Leave Management
- Referral Engine
- Knowledge Base
- Advanced Enhancements

See AGENT.md for details.
