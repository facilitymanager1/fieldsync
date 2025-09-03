/**
 * GraphQL Apollo Server Setup
 * Configures and initializes Apollo Server v4 with Express integration
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { Server as HttpServer } from 'http';
import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';

import typeDefs from './schema';
import resolvers from './resolvers';
import { createContext, Context } from './context';

let server: ApolloServer<Context>;

export async function createApolloServer(httpServer: HttpServer): Promise<{
  server: ApolloServer<Context>;
  middleware: any;
}> {
  // Create executable schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Create WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Set up WebSocket for handling GraphQL subscriptions
  const serverCleanup = useServer({
    schema,
    context: async (ctx, msg, args) => {
      // Create context for WebSocket connections
      // You can add authentication logic here for subscriptions
      return {
        user: null, // Add WebSocket auth logic
        req: null,
        res: null,
      };
    },
  }, wsServer);

  // Create Apollo Server
  server = new ApolloServer<Context>({
    schema,
    plugins: [
      // Proper shutdown for HTTP server
      ApolloServerPluginDrainHttpServer({ httpServer }),
      
      // Proper shutdown for WebSocket server
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },

      // Development introspection and playground
      ...(process.env.NODE_ENV === 'development' ? [] : []),
    ],
    
    introspection: process.env.NODE_ENV === 'development',
    
    formatError: (formattedError, error) => {
      // Log error for debugging
      console.error('GraphQL Error:', formattedError);
      
      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production') {
        // Only return safe error messages in production
        if (formattedError.extensions?.code === 'INTERNAL_SERVER_ERROR') {
          return new Error('Internal server error');
        }
      }
      
      return formattedError;
    },
  });

  // Start the server
  await server.start();

  // Create Express middleware
  const middleware = expressMiddleware(server, {
    context: createContext,
  });

  return { server, middleware };
}

export async function stopApolloServer(): Promise<void> {
  if (server) {
    await server.stop();
  }
}

export { server };