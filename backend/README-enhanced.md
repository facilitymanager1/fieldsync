# FieldSync Backend

Enterprise-grade field service management platform backend built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control (RBAC)
- **Real-time Communication**: Socket.io for live updates and notifications
- **Database Management**: MongoDB with Mongoose ODM for production-ready data persistence
- **Security**: Helmet, rate limiting, CORS, password hashing, account lockout
- **Monitoring**: Health checks, error tracking with Sentry, structured logging
- **File Management**: Multer for file uploads with AWS S3 integration
- **Production Ready**: Docker support, environment configuration, graceful shutdown

## 🏗️ Architecture

```
backend/
├── models/           # MongoDB/Mongoose data models
├── modules/          # Business logic modules
├── routes/           # Express route handlers
├── services/         # Core services (Database, Socket, etc.)
├── middleware/       # Custom middleware functions
├── tests/           # Test files
└── index.ts         # Application entry point
```

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB 6.0+
- npm 8+

## 🛠️ Installation

1. **Clone and navigate to backend directory**
   ```bash
   cd fieldsync/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or using local installation
   mongod
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run build
   npm start
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3001 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/fieldsync |
| `JWT_SECRET` | JWT signing secret | - |
| `SENTRY_DSN` | Sentry error tracking DSN | - |

See `.env.example` for complete configuration options.

## 🔐 Authentication & Authorization

### User Roles

- **Admin**: Full system access
- **Supervisor**: Team and operational management
- **FieldTech**: Field technician access
- **SiteStaff**: On-site staff access
- **Client**: Customer portal access

### JWT Token Structure

```javascript
{
  id: "user_id",
  email: "user@example.com", 
  role: "FieldTech",
  iat: 1640000000,
  exp: 1640028800
}
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Tickets
- `GET /api/tickets` - List tickets with filtering
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/:id` - Get ticket details
- `PUT /api/tickets/:id` - Update ticket
- `DELETE /api/tickets/:id` - Delete ticket

### Real-time Events
- `ticket:created` - New ticket notification
- `ticket:updated` - Ticket status changes
- `location:update` - Staff location updates
- `notification:new` - System notifications

## 🗄️ Database Models

### User Model
```typescript
{
  email: string,
  passwordHash: string,
  role: UserRole,
  profile: {
    firstName: string,
    lastName: string,
    phone?: string,
    department?: string
  },
  preferences: {
    theme: 'light' | 'dark',
    notifications: boolean
  },
  isActive: boolean,
  lastLogin?: Date
}
```

### Ticket Model
```typescript
{
  ticketNumber: number,
  title: string,
  description: string,
  status: 'open' | 'in-progress' | 'completed' | 'cancelled',
  priority: 'low' | 'medium' | 'high' | 'critical',
  category: string,
  assignedTo?: ObjectId,
  client?: ObjectId,
  location?: {
    address: string,
    coordinates: [number, number]
  },
  attachments: ObjectId[],
  comments: CommentObject[],
  statusHistory: StatusHistoryObject[]
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🐳 Docker Deployment

```bash
# Build Docker image
npm run docker:build

# Run container
npm run docker:run

# Or use docker-compose
docker-compose up -d
```

## 📊 Monitoring & Health Checks

### Health Check Endpoint
```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "database": "connected",
  "uptime": 3600,
  "memory": {
    "rss": 45056000,
    "heapTotal": 32768000,
    "heapUsed": 28672000
  }
}
```

### Error Tracking
- Sentry integration for production error monitoring
- Structured logging with Morgan
- Request/response tracking

## 🔒 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Authentication Rate Limiting**: 5 login attempts per 15 minutes
- **Account Lockout**: 5 failed attempts locks account for 2 hours
- **CORS Protection**: Configurable origin restrictions
- **Helmet**: Security headers and XSS protection
- **Password Security**: bcrypt with 12 rounds
- **Input Validation**: Mongoose schema validation

## 🚀 Performance Optimizations

- **Database Indexing**: Optimized MongoDB indexes
- **Compression**: Gzip response compression
- **Connection Pooling**: MongoDB connection management
- **Memory Management**: Graceful shutdown handling

## 📝 API Documentation

Detailed API documentation is available via:
- Swagger UI (development): `http://localhost:3001/api-docs`
- Postman Collection: `docs/FieldSync_API.postman_collection.json`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Documentation: [Wiki](https://github.com/fieldsync/wiki)
- Issues: [GitHub Issues](https://github.com/fieldsync/issues)
- Email: support@fieldsync.app

## 📈 Roadmap

- [ ] GraphQL API support
- [ ] Redis caching layer
- [ ] Advanced analytics engine
- [ ] Microservices architecture
- [ ] Kubernetes deployment manifests
- [ ] Advanced workflow automation
