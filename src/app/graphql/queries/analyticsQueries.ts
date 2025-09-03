/**
 * GraphQL Analytics Queries
 */

import { gql } from '@apollo/client';

// Analytics Queries
export const GET_ANALYTICS_METRICS = gql`
  query GetAnalyticsMetrics {
    analyticsMetrics {
      systemMetrics {
        activeUsers
        totalSessions
        averageResponseTime
        systemLoad
        memoryUsage
        diskUsage
        networkThroughput
        errorRate
      }
      businessMetrics {
        activeTickets
        ticketsCreatedToday
        ticketsResolvedToday
        averageResolutionTime
        slaCompliance
        activeShifts
        staffUtilization
        clientSatisfaction
      }
      operationalMetrics {
        totalSites
        activeSites
        totalStaff
        activeStaff
        upcomingSchedules
        overdueTickets
        criticalAlerts
        maintenanceEvents
      }
      financialMetrics {
        revenueToday
        revenueThisMonth
        costSavings
        efficiency
        budgetUtilization
        profitMargin
      }
    }
  }
`;

export const GET_SYSTEM_HEALTH = gql`
  query GetSystemHealth {
    systemHealth
  }
`;

export const GET_PERFORMANCE_METRICS = gql`
  query GetPerformanceMetrics($timeRange: DateRangeInput) {
    performanceMetrics(timeRange: $timeRange)
  }
`;

export const GENERATE_REPORT = gql`
  query GenerateReport($type: String!, $parameters: JSON!) {
    generateReport(type: $type, parameters: $parameters)
  }
`;

export const EXPORT_DATA = gql`
  query ExportData($entity: String!, $format: String!, $filter: JSON) {
    exportData(entity: $entity, format: $format, filter: $filter)
  }
`;

// Analytics Subscriptions
export const METRICS_UPDATED = gql`
  subscription MetricsUpdated {
    metricsUpdated {
      systemMetrics {
        activeUsers
        totalSessions
        averageResponseTime
        systemLoad
        memoryUsage
        diskUsage
        errorRate
      }
      businessMetrics {
        activeTickets
        ticketsCreatedToday
        ticketsResolvedToday
        averageResolutionTime
        slaCompliance
        activeShifts
        staffUtilization
        clientSatisfaction
      }
      operationalMetrics {
        totalSites
        activeSites
        totalStaff
        activeStaff
        upcomingSchedules
        overdueTickets
        criticalAlerts
        maintenanceEvents
      }
      financialMetrics {
        revenueToday
        revenueThisMonth
        costSavings
        efficiency
        budgetUtilization
        profitMargin
      }
    }
  }
`;

export const SYSTEM_ALERT = gql`
  subscription SystemAlert {
    systemAlert
  }
`;