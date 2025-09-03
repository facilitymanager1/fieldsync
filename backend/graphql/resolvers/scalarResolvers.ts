/**
 * GraphQL Scalar Type Resolvers
 * Custom scalar types for Date, JSON, and Upload
 */

import { GraphQLScalarType, GraphQLError } from 'graphql';
import { Kind } from 'graphql/language';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.mjs';

export const scalarResolvers = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    serialize(value: any) {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new GraphQLError('Invalid date value');
        }
        return date.toISOString();
      }
      throw new GraphQLError('Value must be a Date, string, or number');
    },
    parseValue(value: any) {
      if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new GraphQLError('Invalid date value');
        }
        return date;
      }
      throw new GraphQLError('Value must be a string or number');
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
        const date = new Date(ast.value);
        if (isNaN(date.getTime())) {
          throw new GraphQLError('Invalid date value');
        }
        return date;
      }
      throw new GraphQLError('Value must be a string or number');
    },
  }),

  JSON: new GraphQLScalarType({
    name: 'JSON',
    description: 'JSON custom scalar type',
    serialize(value: any) {
      if (typeof value === 'object') {
        return value;
      }
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new GraphQLError('Invalid JSON string');
        }
      }
      return value;
    },
    parseValue(value: any) {
      if (typeof value === 'object') {
        return value;
      }
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new GraphQLError('Invalid JSON string');
        }
      }
      return value;
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        try {
          return JSON.parse(ast.value);
        } catch (error) {
          throw new GraphQLError('Invalid JSON string');
        }
      }
      if (ast.kind === Kind.OBJECT) {
        return ast;
      }
      return null;
    },
  }),

  Upload: GraphQLUpload,
};