import './config/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { buildCorsOptions } from './config/cors.config';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import oemsRoutes from './modules/oems/oems.routes';
import organizationsRoutes from './modules/organizations/organizations.routes';
import submissionsRoutes from './modules/submissions/submissions.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import statsRoutes from './modules/stats/stats.routes';
import cmsRoutes from './modules/cms/articles.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import messagingRoutes from './modules/messaging/messaging.routes';
import invitationsRoutes from './modules/invitations/invitations.routes';
import settingsRoutes from './modules/settings/settings.routes';
import publicRoutes from './modules/public/verification.routes';
import rbacRoutes from './modules/rbac/rbac.routes';
import { errorHandler } from './shared/middleware/error-handler.middleware';
import { responseFormatter } from './shared/utils/response-formatter';

const app = express();

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors(buildCorsOptions()));
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/rbac', rbacRoutes);
app.use('/api/v1/oems', oemsRoutes);
app.use('/api/v1/organizations', organizationsRoutes);
app.use('/api/v1/submissions', submissionsRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/cms', cmsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/messaging', messagingRoutes);
app.use('/api/v1/invitations', invitationsRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/public', publicRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json(responseFormatter.success(null, 'API is healthy'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json(responseFormatter.error('Route not found', 404));
});

// Global error handler
app.use(errorHandler);

export default app;
