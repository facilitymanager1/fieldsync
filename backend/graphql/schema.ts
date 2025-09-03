/**
 * GraphQL Schema Definition for FieldSync API
 * Comprehensive schema covering all business entities and operations
 */

import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # Scalar types
  scalar Date
  scalar JSON
  scalar Upload

  # Authentication & Authorization
  type User {
    id: ID!
    name: String!
    email: String!
    role: UserRole!
    isActive: Boolean!
    lastLogin: Date
    createdAt: Date!
    updatedAt: Date!
    profile: UserProfile
    permissions: [String!]!
  }

  type UserProfile {
    avatar: String
    phone: String
    address: String
    department: String
    jobTitle: String
    emergencyContact: String
  }

  enum UserRole {
    ADMIN
    SUPERVISOR
    FIELD_TECH
    SITE_STAFF
    CLIENT
  }

  # Core Business Entities
  type Site {
    id: ID!
    name: String!
    address: String!
    coordinates: Coordinates
    isActive: Boolean!
    description: String
    contactPerson: String
    contactPhone: String
    contactEmail: String
    businessHours: BusinessHours
    geofence: Geofence
    tickets: [Ticket!]!
    shifts: [Shift!]!
    staff: [Staff!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type Coordinates {
    latitude: Float!
    longitude: Float!
    accuracy: Float
  }

  type BusinessHours {
    monday: DayHours
    tuesday: DayHours
    wednesday: DayHours
    thursday: DayHours
    friday: DayHours
    saturday: DayHours
    sunday: DayHours
  }

  type DayHours {
    open: String!
    close: String!
    isClosed: Boolean!
  }

  type Geofence {
    id: ID!
    name: String!
    coordinates: [Coordinates!]!
    radius: Float
    type: GeofenceType!
    isActive: Boolean!
    createdAt: Date!
  }

  enum GeofenceType {
    CIRCULAR
    POLYGON
    RECTANGULAR
  }

  type Ticket {
    id: ID!
    title: String!
    description: String!
    priority: TicketPriority!
    status: TicketStatus!
    category: String!
    site: Site!
    assignedTo: User
    createdBy: User!
    dueDate: Date
    resolvedAt: Date
    resolution: String
    attachments: [Attachment!]!
    comments: [Comment!]!
    slaTracker: SLATracker
    timeTracking: TicketTimeTracking
    createdAt: Date!
    updatedAt: Date!
  }

  enum TicketPriority {
    LOW
    MEDIUM
    HIGH
    URGENT
    CRITICAL
  }

  enum TicketStatus {
    OPEN
    ASSIGNED
    IN_PROGRESS
    RESOLVED
    CLOSED
    CANCELLED
  }

  type TicketTimeTracking {
    timeSpent: Int # minutes
    estimatedTime: Int # minutes
    startTime: Date
    endTime: Date
  }

  type Comment {
    id: ID!
    content: String!
    author: User!
    ticket: Ticket!
    createdAt: Date!
    updatedAt: Date!
  }

  type Attachment {
    id: ID!
    filename: String!
    url: String!
    mimeType: String!
    size: Int!
    uploadedBy: User!
    createdAt: Date!
  }

  # Staff & Shift Management
  type Staff {
    id: ID!
    user: User!
    employeeId: String!
    department: String!
    skills: [String!]!
    certifications: [Certification!]!
    isActive: Boolean!
    shifts: [Shift!]!
    currentShift: Shift
    location: Location
    createdAt: Date!
    updatedAt: Date!
  }

  type Certification {
    name: String!
    issuer: String!
    issueDate: Date!
    expiryDate: Date
    certificateUrl: String
  }

  type Shift {
    id: ID!
    staff: Staff!
    site: Site!
    startTime: Date!
    endTime: Date!
    actualStartTime: Date
    actualEndTime: Date
    status: ShiftStatus!
    type: ShiftType!
    notes: String
    location: Location
    breaks: [Break!]!
    totalDuration: Int # minutes
    createdAt: Date!
    updatedAt: Date!
  }

  enum ShiftStatus {
    SCHEDULED
    ACTIVE
    COMPLETED
    CANCELLED
    NO_SHOW
  }

  enum ShiftType {
    REGULAR
    OVERTIME
    EMERGENCY
    REPLACEMENT
  }

  type Break {
    startTime: Date!
    endTime: Date
    type: BreakType!
    notes: String
  }

  enum BreakType {
    LUNCH
    REST
    EMERGENCY
    OTHER
  }

  type Location {
    coordinates: Coordinates!
    address: String
    timestamp: Date!
    accuracy: Float
    provider: String
  }

  # SLA Management
  type SLATracker {
    id: ID!
    ticket: Ticket!
    template: SLATemplate!
    status: SLAStatus!
    targetTime: Date!
    actualTime: Date
    breachReason: String
    escalations: [SLAEscalation!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type SLATemplate {
    id: ID!
    name: String!
    description: String!
    rules: JSON!
    responseTime: Int! # minutes
    resolutionTime: Int! # minutes
    escalationRules: [EscalationRule!]!
    isActive: Boolean!
    createdAt: Date!
    updatedAt: Date!
  }

  enum SLAStatus {
    ACTIVE
    MET
    BREACHED
    PAUSED
    CANCELLED
  }

  type SLAEscalation {
    level: Int!
    triggeredAt: Date!
    notifiedUsers: [User!]!
    action: String!
  }

  type EscalationRule {
    level: Int!
    delayMinutes: Int!
    notifyUsers: [String!]!
    actions: [String!]!
  }

  # Analytics & Reporting
  type AnalyticsMetrics {
    systemMetrics: SystemMetrics!
    businessMetrics: BusinessMetrics!
    operationalMetrics: OperationalMetrics!
    financialMetrics: FinancialMetrics!
  }

  type SystemMetrics {
    activeUsers: Int!
    totalSessions: Int!
    averageResponseTime: Float!
    systemLoad: Float!
    memoryUsage: Float!
    diskUsage: Float!
    errorRate: Float!
  }

  type BusinessMetrics {
    activeTickets: Int!
    ticketsCreatedToday: Int!
    ticketsResolvedToday: Int!
    averageResolutionTime: Float!
    slaCompliance: Float!
    activeShifts: Int!
    staffUtilization: Float!
    clientSatisfaction: Float!
  }

  type OperationalMetrics {
    totalSites: Int!
    activeSites: Int!
    totalStaff: Int!
    activeStaff: Int!
    upcomingSchedules: Int!
    overdueTickets: Int!
    criticalAlerts: Int!
    maintenanceEvents: Int!
  }

  type FinancialMetrics {
    revenueToday: Float!
    revenueThisMonth: Float!
    costSavings: Float!
    efficiency: Float!
    budgetUtilization: Float!
    profitMargin: Float!
  }

  # Communication & Notifications
  type Notification {
    id: ID!
    title: String!
    message: String!
    type: NotificationType!
    priority: NotificationPriority!
    recipient: User!
    isRead: Boolean!
    data: JSON
    createdAt: Date!
    readAt: Date
  }

  enum NotificationType {
    TICKET_ASSIGNED
    TICKET_UPDATED
    SHIFT_REMINDER
    SLA_BREACH
    SYSTEM_ALERT
    GENERAL
  }

  enum NotificationPriority {
    LOW
    MEDIUM
    HIGH
    URGENT
  }

  # Input Types
  input UserInput {
    name: String!
    email: String!
    role: UserRole!
    password: String!
    profile: UserProfileInput
  }

  input UserProfileInput {
    avatar: String
    phone: String
    address: String
    department: String
    jobTitle: String
    emergencyContact: String
  }

  input SiteInput {
    name: String!
    address: String!
    coordinates: CoordinatesInput
    description: String
    contactPerson: String
    contactPhone: String
    contactEmail: String
    businessHours: BusinessHoursInput
  }

  input CoordinatesInput {
    latitude: Float!
    longitude: Float!
    accuracy: Float
  }

  input BusinessHoursInput {
    monday: DayHoursInput
    tuesday: DayHoursInput
    wednesday: DayHoursInput
    thursday: DayHoursInput
    friday: DayHoursInput
    saturday: DayHoursInput
    sunday: DayHoursInput
  }

  input DayHoursInput {
    open: String!
    close: String!
    isClosed: Boolean!
  }

  input TicketInput {
    title: String!
    description: String!
    priority: TicketPriority!
    category: String!
    siteId: ID!
    assignedToId: ID
    dueDate: Date
  }

  input ShiftInput {
    staffId: ID!
    siteId: ID!
    startTime: Date!
    endTime: Date!
    type: ShiftType!
    notes: String
  }

  # Filtering and Pagination
  input TicketFilter {
    status: TicketStatus
    priority: TicketPriority
    category: String
    siteId: ID
    assignedToId: ID
    createdBy: ID
    dateRange: DateRangeInput
  }

  input DateRangeInput {
    start: Date!
    end: Date!
  }

  input PaginationInput {
    limit: Int = 20
    offset: Int = 0
    sortBy: String
    sortOrder: SortOrder = ASC
  }

  enum SortOrder {
    ASC
    DESC
  }

  type PaginatedTickets {
    tickets: [Ticket!]!
    totalCount: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  type PaginatedShifts {
    shifts: [Shift!]!
    totalCount: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  # Mutations
  type Mutation {
    # User Management
    createUser(input: UserInput!): User!
    updateUser(id: ID!, input: UserInput!): User!
    deleteUser(id: ID!): Boolean!

    # Site Management
    createSite(input: SiteInput!): Site!
    updateSite(id: ID!, input: SiteInput!): Site!
    deleteSite(id: ID!): Boolean!

    # Ticket Management
    createTicket(input: TicketInput!): Ticket!
    updateTicket(id: ID!, input: TicketInput!): Ticket!
    assignTicket(ticketId: ID!, userId: ID!): Ticket!
    resolveTicket(ticketId: ID!, resolution: String!): Ticket!
    addTicketComment(ticketId: ID!, content: String!): Comment!
    deleteTicket(id: ID!): Boolean!

    # Shift Management
    createShift(input: ShiftInput!): Shift!
    updateShift(id: ID!, input: ShiftInput!): Shift!
    startShift(shiftId: ID!): Shift!
    endShift(shiftId: ID!): Shift!
    addBreak(shiftId: ID!, type: BreakType!, notes: String): Break!
    deleteShift(id: ID!): Boolean!

    # File Upload
    uploadFile(file: Upload!): Attachment!

    # Notifications
    markNotificationAsRead(id: ID!): Notification!
    markAllNotificationsAsRead: Boolean!
  }

  # Queries
  type Query {
    # User Queries
    me: User
    user(id: ID!): User
    users(filter: String, pagination: PaginationInput): [User!]!

    # Site Queries
    site(id: ID!): Site
    sites(pagination: PaginationInput): [Site!]!

    # Ticket Queries
    ticket(id: ID!): Ticket
    tickets(filter: TicketFilter, pagination: PaginationInput): PaginatedTickets!
    myTickets(filter: TicketFilter, pagination: PaginationInput): PaginatedTickets!

    # Shift Queries
    shift(id: ID!): Shift
    shifts(filter: JSON, pagination: PaginationInput): PaginatedShifts!
    myShifts(filter: JSON, pagination: PaginationInput): PaginatedShifts!
    currentShift: Shift

    # SLA Queries
    slaTemplate(id: ID!): SLATemplate
    slaTemplates: [SLATemplate!]!
    slaTracker(id: ID!): SLATracker
    slaTrackers(filter: JSON): [SLATracker!]!

    # Analytics Queries
    analyticsMetrics: AnalyticsMetrics!
    systemHealth: JSON!
    performanceMetrics(timeRange: DateRangeInput): JSON!

    # Notification Queries
    myNotifications(unreadOnly: Boolean, pagination: PaginationInput): [Notification!]!
    unreadNotificationCount: Int!

    # Reporting Queries
    generateReport(type: String!, parameters: JSON!): JSON!
    exportData(entity: String!, format: String!, filter: JSON): String!
  }

  # Subscriptions for Real-time Updates
  type Subscription {
    # Ticket Subscriptions
    ticketUpdated(ticketId: ID): Ticket!
    ticketCreated(siteId: ID): Ticket!
    ticketAssigned(userId: ID): Ticket!

    # Shift Subscriptions
    shiftStarted(siteId: ID): Shift!
    shiftEnded(siteId: ID): Shift!
    shiftUpdated(shiftId: ID): Shift!

    # Analytics Subscriptions
    metricsUpdated: AnalyticsMetrics!
    systemAlert: JSON!

    # Notification Subscriptions
    notificationReceived(userId: ID!): Notification!

    # Location Subscriptions
    locationUpdated(staffId: ID!): Location!
  }
`;

export default typeDefs;