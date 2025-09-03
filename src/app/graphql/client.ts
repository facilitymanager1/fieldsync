/**
 * Apollo GraphQL Client Configuration
 * Provides GraphQL client with authentication and caching
 */

import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { split } from '@apollo/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_BASE_URL = API_BASE_URL.replace('http', 'ws');

// HTTP Link for queries and mutations
const httpLink = createHttpLink({
  uri: `${API_BASE_URL}/graphql`,
  credentials: 'same-origin',
});

// WebSocket Link for subscriptions
const wsLink = typeof window !== 'undefined' ? new GraphQLWsLink(createClient({
  url: `${WS_BASE_URL}/graphql`,
  connectionParams: () => {
    const token = localStorage.getItem('token');
    return {
      authorization: token ? `Bearer ${token}` : '',
    };
  },
})) : null;

// Authentication Link
const authLink = setContext((_, { headers }) => {
  // Get token from localStorage
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  };
});

// Error Link
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Clear token and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    
    // Handle network errors
    if (networkError.message === 'Failed to fetch') {
      // Handle offline scenarios
      console.warn('Network request failed - possibly offline');
    }
  }
});

// Split link to route queries/mutations to HTTP and subscriptions to WebSocket
const splitLink = typeof window !== 'undefined' && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLink,
    )
  : httpLink;

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: from([
    errorLink,
    authLink,
    splitLink,
  ]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Pagination handling for tickets
          tickets: {
            keyArgs: ['filter'],
            merge(existing = { tickets: [], totalCount: 0 }, incoming) {
              return {
                ...incoming,
                tickets: [...existing.tickets, ...incoming.tickets],
              };
            },
          },
          // Pagination handling for shifts
          shifts: {
            keyArgs: ['filter'],
            merge(existing = { shifts: [], totalCount: 0 }, incoming) {
              return {
                ...incoming,
                shifts: [...existing.shifts, ...incoming.shifts],
              };
            },
          },
          // Cache notifications
          myNotifications: {
            merge(existing = [], incoming) {
              return incoming;
            },
          },
        },
      },
      // Cache policy for tickets
      Ticket: {
        fields: {
          comments: {
            merge(existing = [], incoming) {
              return incoming;
            },
          },
          attachments: {
            merge(existing = [], incoming) {
              return incoming;
            },
          },
        },
      },
      // Cache policy for users
      User: {
        keyFields: ['id'],
      },
      // Cache policy for sites
      Site: {
        keyFields: ['id'],
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'ignore',
      fetchPolicy: 'cache-and-network',
    },
    query: {
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
  // Enable developer tools in development
  connectToDevTools: process.env.NODE_ENV === 'development',
});

export default apolloClient;