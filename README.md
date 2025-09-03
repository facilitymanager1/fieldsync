
# Field-Staff Management Platform

This monorepo contains a full-stack solution for Facility Management companies, as described in AGENT.md.

## Structure
- **Web Dashboard** (Next.js, TypeScript): root
- **Backend API** (Node.js/Express or Python/FastAPI): `/backend`
- **Mobile App** (React Native): `/mobile`
- **.github/copilot-instructions.md**: Copilot guidance

## Key Modules (see AGENT.md for details)
- Authentication & Security
- Geofence & Location Trigger
- Shift State Machine & Business Logic
- Passive Location & Sensor Gating
- Odometer & Photo Verification
- Sync & Reconciliation
- Service Reporting & Checklists
- Planner & Calendar Integration
- Dashboards & Analytics
- Data Storage & Encryption
- Feature Flags & Configuration
- CI/CD & Operations
- Work-Order & Ticket Support Desk
- Meeting Minutes & Action Items
- SLA & Compliance Engine
- Replacement Duty & Contract Rates
- Facial Recognition Attendance
- Leave Management
- Lead Generation & Referral Engine
- Knowledge Base & Training
- Advanced Enhancements & Future Roadmap

## Getting Started
- Web: `npm run dev`
- Backend: see `/backend/README.md`
- Mobile: see `/mobile/README.md`

## CI/CD, Analytics, and Integrations
See AGENT.md for pipeline, analytics, and integration details.
