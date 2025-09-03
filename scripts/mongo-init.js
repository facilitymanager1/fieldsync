// MongoDB Initialization Script for FieldSync
// This script runs when MongoDB container starts for the first time

db = db.getSiblingDB('fieldsync');

// Create application user with appropriate permissions
db.createUser({
  user: 'fieldsync_app',
  pwd: 'fieldsync_app_password_123',
  roles: [
    {
      role: 'readWrite',
      db: 'fieldsync'
    }
  ]
});

print('FieldSync database user created successfully');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'role', 'isActive'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        },
        role: {
          bsonType: 'string',
          enum: ['admin', 'supervisor', 'fieldtech', 'sitestaff', 'client']
        },
        isActive: {
          bsonType: 'bool'
        }
      }
    }
  }
});

db.createCollection('tickets', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'status', 'priority', 'createdBy'],
      properties: {
        status: {
          bsonType: 'string',
          enum: ['created', 'assigned', 'in-progress', 'completed', 'closed']
        },
        priority: {
          bsonType: 'string',
          enum: ['low', 'medium', 'high', 'critical']
        }
      }
    }
  }
});

db.createCollection('shifts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'status'],
      properties: {
        status: {
          bsonType: 'string',
          enum: ['idle', 'in-shift', 'post-shift']
        }
      }
    }
  }
});

db.createCollection('locations');
db.createCollection('geofences');
db.createCollection('auditlogs');
db.createCollection('notifications');
db.createCollection('expenses');
db.createCollection('meetings');
db.createCollection('slas');

print('Collections created with validation rules');

// Create initial indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1, isActive: 1 });

db.tickets.createIndex({ status: 1, priority: 1, createdAt: -1 });
db.tickets.createIndex({ assignedTo: 1, status: 1 });

db.shifts.createIndex({ userId: 1, startTime: -1 });
db.shifts.createIndex({ status: 1, startTime: 1 });

db.locations.createIndex({ userId: 1, timestamp: -1 });
db.locations.createIndex({ coordinates: '2dsphere' });

db.geofences.createIndex({ 'area.coordinates': '2dsphere' });
db.geofences.createIndex({ isActive: 1, type: 1 });

db.auditlogs.createIndex({ userId: 1, timestamp: -1 });
db.auditlogs.createIndex({ action: 1, timestamp: -1 });

db.notifications.createIndex({ userId: 1, isRead: 1, createdAt: -1 });

db.expenses.createIndex({ userId: 1, submittedAt: -1 });
db.expenses.createIndex({ status: 1, submittedAt: -1 });

db.meetings.createIndex({ 'attendees.userId': 1, scheduledAt: -1 });

db.slas.createIndex({ ticketId: 1 }, { unique: true });

print('Initial indexes created');

// Insert default admin user (password should be changed in production)
db.users.insertOne({
  email: 'admin@fieldsync.com',
  password: '$2b$10$8C8KvM5Q5dNjR7vGm.AXXeY1Vh.HY8U.zP2bVKnE1DQJ8M.U4K8Ue', // password: admin123
  role: 'admin',
  isActive: true,
  profile: {
    firstName: 'System',
    lastName: 'Administrator',
    department: 'IT',
    designation: 'System Admin'
  },
  createdAt: new Date(),
  lastLogin: null
});

print('Default admin user created (email: admin@fieldsync.com, password: admin123)');

// Create system configuration
db.createCollection('config');
db.config.insertOne({
  _id: 'system',
  appName: 'FieldSync',
  version: '1.0.0',
  features: {
    geofencing: true,
    offline: true,
    analytics: true,
    sla: true,
    expenses: true,
    meetings: true
  },
  security: {
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    },
    sessionTimeout: 8 * 60 * 60 * 1000, // 8 hours
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
  },
  notifications: {
    email: true,
    push: true,
    sms: false
  },
  createdAt: new Date(),
  updatedAt: new Date()
});

print('System configuration created');

// Create sample geofences for testing
db.geofences.insertMany([
  {
    name: 'Main Office',
    type: 'office',
    area: {
      type: 'Polygon',
      coordinates: [[
        [77.5946, 12.9716],
        [77.5950, 12.9716],
        [77.5950, 12.9720],
        [77.5946, 12.9720],
        [77.5946, 12.9716]
      ]]
    },
    isActive: true,
    allowedRoles: ['admin', 'supervisor', 'fieldtech', 'sitestaff'],
    createdAt: new Date()
  },
  {
    name: 'Client Site A',
    type: 'client-site',
    area: {
      type: 'Polygon',
      coordinates: [[
        [77.6000, 12.9800],
        [77.6010, 12.9800],
        [77.6010, 12.9810],
        [77.6000, 12.9810],
        [77.6000, 12.9800]
      ]]
    },
    isActive: true,
    allowedRoles: ['fieldtech', 'sitestaff'],
    createdAt: new Date()
  }
]);

print('Sample geofences created');

print('FieldSync MongoDB initialization completed successfully!');
print('');
print('📊 Database: fieldsync');
print('👤 App User: fieldsync_app');
print('🔐 Admin Login: admin@fieldsync.com / admin123');
print('⚠️  IMPORTANT: Change default passwords in production!');
print('');