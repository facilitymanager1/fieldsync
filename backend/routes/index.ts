// Central export for all routes
import { Router } from 'express';
import notificationRoutes from './notificationRoutes';
import advancedSlaRoutes from './advancedSlaRoutes';
import expenseRoutes from './expenseRoutes';
import kioskRoutes from './kioskRoutes';
import calendarRoutes from './calendarRoutes';
import passiveLocationRoutes from './passiveLocationRoutes';
import advancedStorageRoutes from './advancedStorageRoutes';
import approvalRoutes from './approvalRoutes';

const router = Router();

router.use('/notifications', notificationRoutes);
router.use('/sla', advancedSlaRoutes);
router.use('/expenses', expenseRoutes);
router.use('/kiosk', kioskRoutes);
router.use('/calendar', calendarRoutes);
router.use('/location', passiveLocationRoutes);
router.use('/storage', advancedStorageRoutes);
router.use('/approvals', approvalRoutes);

export { default as auditLogRoutes } from './auditLogRoutes';
export { default as externalIntegrationRoutes } from './externalIntegrationRoutes';
export { default as advancedSlaRoutes } from './advancedSlaRoutes';
export { default as expenseRoutes } from './expenseRoutes';
export { default as kioskRoutes } from './kioskRoutes';
export { default as calendarRoutes } from './calendarRoutes';
export { default as passiveLocationRoutes } from './passiveLocationRoutes';
export { default as advancedStorageRoutes } from './advancedStorageRoutes';
export { default as approvalRoutes } from './approvalRoutes';

export default router;
