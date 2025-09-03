import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import socketService from './services/SocketService';
import DatabaseService from './services/DatabaseService';

dotenv.config();

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
});

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealth = await DatabaseService.getInstance().healthCheck();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbHealth ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// Import routes
import authRoutes from './routes/authenticationRoutes';
import geofenceRoutes from './routes/geofenceRoutes';
import shiftRoutes from './routes/shiftRoutes';
import locationRoutes from './routes/locationRoutes';
import odometerRoutes from './routes/odometerRoutes';
import syncRoutes from './routes/syncRoutes';
import serviceReportRoutes from './routes/serviceReportRoutes';
import plannerRoutes from './routes/plannerRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import storageRoutes from './routes/storageRoutes';
import communicationRoutes from './routes/communicationRoutes';
import featureFlagRoutes from './routes/featureFlagRoutes';
import ticketRoutes from './routes/ticketRoutes';
import meetingRoutes from './routes/meetingRoutes';
import slaRoutes from './routes/slaRoutes';
import replacementDutyRoutes from './routes/replacementDutyRoutes';
import notificationRoutes from './routes/notificationRoutes';
import enhancementRoutes from './routes/enhancementRoutes';
import auditLogRoutes from './routes/auditLogRoutes';
import externalIntegrationRoutes from './routes/externalIntegrationRoutes';
import attachmentRoutes from './routes/attachmentRoutes';
import staffRoutes from './routes/staffRoutes';
import knowledgeBaseRoutes from './routes/knowledgeBaseRoutes';
import leadRoutes from './routes/leadRoutes';
import leaveRoutes from './routes/leaveRoutes';
import facialRecognitionRoutes from './routes/facialRecognitionRoutes';
import expenseRoutes from './routes/expenseRoutes';
import kioskRoutes from './routes/kioskRoutes';
app.use('/auth', authRoutes);
app.use('/attachments', attachmentRoutes);
app.use('/geofence', geofenceRoutes);
app.use('/shift', shiftRoutes);
app.use('/location', locationRoutes);
app.use('/odometer', odometerRoutes);
app.use('/sync', syncRoutes);
app.use('/service-report', serviceReportRoutes);
app.use('/planner', plannerRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/storage', storageRoutes);
app.use('/communication', communicationRoutes);
app.use('/feature-flag', featureFlagRoutes);
app.use('/ticket', ticketRoutes);
app.use('/meeting', meetingRoutes);
app.use('/sla', slaRoutes);
app.use('/replacement-duty', replacementDutyRoutes);
app.use('/facial-recognition', facialRecognitionRoutes);
app.use('/leave', leaveRoutes);
app.use('/staff', staffRoutes);
app.use('/lead', leadRoutes);
app.use('/knowledge-base', knowledgeBaseRoutes);
app.use('/expenses', expenseRoutes);
app.use('/kiosk', kioskRoutes);

app.use('/audit-logs', auditLogRoutes);
app.use('/integrate', externalIntegrationRoutes);

app.use('/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.send('FieldSync Backend API is running');
});

// Sentry error handler should be last
app.use(Sentry.expressErrorHandler());

const PORT = process.env.PORT || 3001;

// Only start server if run directly, not when imported for tests
if (require.main === module) {
  // Initialize database connection
  DatabaseService.getInstance().connect()
    .then(() => {
      console.log('✅ Database connected successfully');
      
      // Initialize Socket.IO
      socketService.initialize(httpServer);
      console.log('✅ Socket.IO initialized');
      
      httpServer.listen(PORT, () => {
        console.log(`🚀 FieldSync Backend API running on port ${PORT}`);
        console.log(`📡 Health check available at http://localhost:${PORT}/health`);
      });
    })
    .catch((err: Error) => {
      console.error('❌ Database connection failed:', err);
      process.exit(1);
    });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('⚠️ SIGTERM received, shutting down gracefully');
    await DatabaseService.getInstance().disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('⚠️ SIGINT received, shutting down gracefully');
    await DatabaseService.getInstance().disconnect();
    process.exit(0);
  });
}

export default app;
