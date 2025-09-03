/**
 * GraphQL User Queries and Mutations
 */

import { gql } from '@apollo/client';

// User Fragments
export const USER_FRAGMENT = gql`
  fragment UserInfo on User {
    id
    name
    email
    role
    isActive
    lastLogin
    createdAt
    updatedAt
    profile {
      avatar
      phone
      address
      department
      jobTitle
      emergencyContact
    }
    permissions
  }
`;

// Queries
export const GET_CURRENT_USER = gql`
  ${USER_FRAGMENT}
  query GetCurrentUser {
    me {
      ...UserInfo
    }
  }
`;

export const GET_USER = gql`
  ${USER_FRAGMENT}
  query GetUser($id: ID!) {
    user(id: $id) {
      ...UserInfo
    }
  }
`;

export const GET_USERS = gql`
  ${USER_FRAGMENT}
  query GetUsers($filter: String, $pagination: PaginationInput) {
    users(filter: $filter, pagination: $pagination) {
      ...UserInfo
    }
  }
`;

// Mutations
export const CREATE_USER = gql`
  ${USER_FRAGMENT}
  mutation CreateUser($input: UserInput!) {
    createUser(input: $input) {
      ...UserInfo
    }
  }
`;

export const UPDATE_USER = gql`
  ${USER_FRAGMENT}
  mutation UpdateUser($id: ID!, $input: UserInput!) {
    updateUser(id: $id, input: $input) {
      ...UserInfo
    }
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: ID!) {
    deleteUser(id: $id)
  }
`;