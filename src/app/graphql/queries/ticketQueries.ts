/**
 * GraphQL Ticket Queries and Mutations
 */

import { gql } from '@apollo/client';

// Ticket Fragments
export const TICKET_FRAGMENT = gql`
  fragment TicketInfo on Ticket {
    id
    title
    description
    priority
    status
    category
    dueDate
    resolvedAt
    resolution
    createdAt
    updatedAt
    site {
      id
      name
      address
    }
    assignedTo {
      id
      name
      email
    }
    createdBy {
      id
      name
      email
    }
    timeTracking {
      timeSpent
      estimatedTime
      startTime
      endTime
    }
  }
`;

export const COMMENT_FRAGMENT = gql`
  fragment CommentInfo on Comment {
    id
    content
    createdAt
    updatedAt
    author {
      id
      name
      email
    }
  }
`;

// Queries
export const GET_TICKET = gql`
  ${TICKET_FRAGMENT}
  ${COMMENT_FRAGMENT}
  query GetTicket($id: ID!) {
    ticket(id: $id) {
      ...TicketInfo
      comments {
        ...CommentInfo
      }
      attachments {
        id
        filename
        url
        mimeType
        size
        createdAt
        uploadedBy {
          id
          name
        }
      }
      slaTracker {
        id
        status
        targetTime
        actualTime
        breachReason
      }
    }
  }
`;

export const GET_TICKETS = gql`
  ${TICKET_FRAGMENT}
  query GetTickets($filter: TicketFilter, $pagination: PaginationInput) {
    tickets(filter: $filter, pagination: $pagination) {
      tickets {
        ...TicketInfo
      }
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
`;

export const GET_MY_TICKETS = gql`
  ${TICKET_FRAGMENT}
  query GetMyTickets($filter: TicketFilter, $pagination: PaginationInput) {
    myTickets(filter: $filter, pagination: $pagination) {
      tickets {
        ...TicketInfo
      }
      totalCount
      hasNextPage
      hasPreviousPage
    }
  }
`;

// Mutations
export const CREATE_TICKET = gql`
  ${TICKET_FRAGMENT}
  mutation CreateTicket($input: TicketInput!) {
    createTicket(input: $input) {
      ...TicketInfo
    }
  }
`;

export const UPDATE_TICKET = gql`
  ${TICKET_FRAGMENT}
  mutation UpdateTicket($id: ID!, $input: TicketInput!) {
    updateTicket(id: $id, input: $input) {
      ...TicketInfo
    }
  }
`;

export const ASSIGN_TICKET = gql`
  ${TICKET_FRAGMENT}
  mutation AssignTicket($ticketId: ID!, $userId: ID!) {
    assignTicket(ticketId: $ticketId, userId: $userId) {
      ...TicketInfo
    }
  }
`;

export const RESOLVE_TICKET = gql`
  ${TICKET_FRAGMENT}
  mutation ResolveTicket($ticketId: ID!, $resolution: String!) {
    resolveTicket(ticketId: $ticketId, resolution: $resolution) {
      ...TicketInfo
    }
  }
`;

export const ADD_TICKET_COMMENT = gql`
  ${COMMENT_FRAGMENT}
  mutation AddTicketComment($ticketId: ID!, $content: String!) {
    addTicketComment(ticketId: $ticketId, content: $content) {
      ...CommentInfo
    }
  }
`;

export const DELETE_TICKET = gql`
  mutation DeleteTicket($id: ID!) {
    deleteTicket(id: $id)
  }
`;

// Subscriptions
export const TICKET_UPDATED = gql`
  ${TICKET_FRAGMENT}
  subscription TicketUpdated($ticketId: ID) {
    ticketUpdated(ticketId: $ticketId) {
      ...TicketInfo
    }
  }
`;

export const TICKET_CREATED = gql`
  ${TICKET_FRAGMENT}
  subscription TicketCreated($siteId: ID) {
    ticketCreated(siteId: $siteId) {
      ...TicketInfo
    }
  }
`;

export const TICKET_ASSIGNED = gql`
  ${TICKET_FRAGMENT}
  subscription TicketAssigned($userId: ID) {
    ticketAssigned(userId: $userId) {
      ...TicketInfo
    }
  }
`;