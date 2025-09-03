/**
 * GraphQL Resolvers for FieldSync API
 * Main resolver exports combining all entity resolvers
 */

import { mergeResolvers } from '@graphql-tools/merge';
import { userResolvers } from './userResolvers';
import { siteResolvers } from './siteResolvers';
import { ticketResolvers } from './ticketResolvers';
import { shiftResolvers } from './shiftResolvers';
import { analyticsResolvers } from './analyticsResolvers';
import { notificationResolvers } from './notificationResolvers';
import { slaResolvers } from './slaResolvers';
import { scalarResolvers } from './scalarResolvers';

const resolvers = mergeResolvers([
  scalarResolvers,
  userResolvers,
  siteResolvers,
  ticketResolvers,
  shiftResolvers,
  analyticsResolvers,
  notificationResolvers,
  slaResolvers,
]);

export default resolvers;