import cron, { ScheduledTask } from 'node-cron';
import tokenService from './tokenService';
import User from '../models/user';
import { securityConfig } from '../config/security';

class SecurityCleanupService {
  private isRunning = false;
  private cleanupTasks: Map<string, ScheduledTask> = new Map();

  /**
   * Start all security cleanup services
   */
  start() {
    if (this.isRunning) {
      console.log('Security cleanup service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting security cleanup service...');

    // Schedule token cleanup - every hour
    this.scheduleTask('tokenCleanup', '0 * * * *', this.cleanupExpiredTokens.bind(this));

    // Schedule failed login cleanup - every 6 hours
    this.scheduleTask('loginCleanup', '0 */6 * * *', this.cleanupFailedLoginAttempts.bind(this));

    // Schedule user session validation - every 30 minutes
    this.scheduleTask('sessionValidation', '*/30 * * * *', this.validateUserSessions.bind(this));

    // Schedule security audit - daily at 2 AM
    this.scheduleTask('securityAudit', '0 2 * * *', this.performSecurityAudit.bind(this));

    console.log('Security cleanup service started successfully');
  }

  /**
   * Stop all security cleanup services
   */
  stop() {
    if (!this.isRunning) {
      console.log('Security cleanup service is not running');
      return;
    }

    console.log('Stopping security cleanup service...');

    // Clear all scheduled tasks
    this.cleanupTasks.forEach((task, name) => {
      task.stop();
      console.log(`Stopped cleanup task: ${name}`);
    });

    this.cleanupTasks.clear();
    this.isRunning = false;

    console.log('Security cleanup service stopped');
  }

  /**
   * Schedule a cleanup task
   */
  private scheduleTask(name: string, schedule: string, task: () => Promise<void>) {
    try {
      const cronTask = cron.schedule(schedule, async () => {
        try {
          console.log(`Running security cleanup task: ${name}`);
          await task();
          console.log(`Completed security cleanup task: ${name}`);
        } catch (error) {
          console.error(`Error in security cleanup task ${name}:`, error);
        }
      }, {
        scheduled: true,
        timezone: process.env.TZ || 'UTC'
      });

      this.cleanupTasks.set(name, cronTask);
      console.log(`Scheduled security cleanup task: ${name} with schedule: ${schedule}`);
    } catch (error) {
      console.error(`Failed to schedule security cleanup task ${name}:`, error);
    }
  }

  /**
   * Clean up expired refresh tokens
   */
  private async cleanupExpiredTokens(): Promise<void> {
    try {
      const cleanedCount = await tokenService.cleanupExpiredTokens();
      
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired refresh tokens`);
      }
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
    }
  }

  /**
   * Clean up failed login attempts and unlock accounts
   */
  private async cleanupFailedLoginAttempts(): Promise<void> {
    try {
      const now = new Date();
      
      // Reset login attempts for accounts whose lockout period has expired
      const result = await User.updateMany(
        {
          lockUntil: { $lte: now },
          loginAttempts: { $gt: 0 }
        },
        {
          $unset: { lockUntil: 1 },
          $set: { loginAttempts: 0 }
        }
      );

      if (result.modifiedCount > 0) {
        console.log(`Unlocked ${result.modifiedCount} user accounts`);
      }

      // Clean up old login attempts (older than 30 days)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oldAttemptsResult = await User.updateMany(
        {
          lastLogin: { $lt: thirtyDaysAgo },
          loginAttempts: { $gt: 0 },
          lockUntil: { $exists: false }
        },
        {
          $set: { loginAttempts: 0 }
        }
      );

      if (oldAttemptsResult.modifiedCount > 0) {
        console.log(`Reset login attempts for ${oldAttemptsResult.modifiedCount} inactive accounts`);
      }
    } catch (error) {
      console.error('Error cleaning up failed login attempts:', error);
    }
  }

  /**
   * Validate user sessions and revoke inactive ones
   */
  private async validateUserSessions(): Promise<void> {
    try {
      // Find users with very old last login (inactive for more than 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const inactiveUsers = await User.find({
        lastLogin: { $lt: ninetyDaysAgo },
        isActive: true
      }).select('_id');

      let revokedSessions = 0;
      for (const user of inactiveUsers) {
        try {
          await tokenService.revokeAllUserTokens(user._id.toString());
          revokedSessions++;
        } catch (error) {
          console.error(`Error revoking sessions for user ${user._id}:`, error);
        }
      }

      if (revokedSessions > 0) {
        console.log(`Revoked sessions for ${revokedSessions} inactive users`);
      }

      // Check for users with too many concurrent sessions
      const activeUsers = await User.find({
        isActive: true,
        lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Active in last 7 days
      }).select('_id');

      let excessiveSessionsRevoked = 0;
      for (const user of activeUsers) {
        try {
          const userSessions = await tokenService.getUserActiveTokens(user._id.toString());
          
          if (userSessions.length > securityConfig.session.maxConcurrentSessions) {
            // Sort by creation date and keep only the most recent sessions
            const sortedSessions = userSessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            const sessionsToRevoke = sortedSessions.slice(securityConfig.session.maxConcurrentSessions);
            
            for (const session of sessionsToRevoke) {
              await tokenService.revokeRefreshToken(session.tokenId);
              excessiveSessionsRevoked++;
            }
          }
        } catch (error) {
          console.error(`Error validating sessions for user ${user._id}:`, error);
        }
      }

      if (excessiveSessionsRevoked > 0) {
        console.log(`Revoked ${excessiveSessionsRevoked} excessive user sessions`);
      }
    } catch (error) {
      console.error('Error validating user sessions:', error);
    }
  }

  /**
   * Perform daily security audit
   */
  private async performSecurityAudit(): Promise<void> {
    try {
      const auditResults = {
        totalUsers: 0,
        activeUsers: 0,
        lockedUsers: 0,
        inactiveUsers: 0,
        activeSessions: 0,
        suspiciousActivity: []
      };

      // Count users by status
      const userCounts = await User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
            locked: { $sum: { $cond: [{ $ne: ['$lockUntil', null] }, 1, 0] } },
            inactive: { $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } }
          }
        }
      ]);

      if (userCounts.length > 0) {
        const counts = userCounts[0];
        auditResults.totalUsers = counts.total;
        auditResults.activeUsers = counts.active;
        auditResults.lockedUsers = counts.locked;
        auditResults.inactiveUsers = counts.inactive;
      }

      // Count active sessions
      const activeUsers = await User.find({ isActive: true }).select('_id');
      let totalActiveSessions = 0;

      for (const user of activeUsers) {
        try {
          const userSessions = await tokenService.getUserActiveTokens(user._id.toString());
          totalActiveSessions += userSessions.length;
        } catch (error) {
          // Continue with other users if one fails
        }
      }

      auditResults.activeSessions = totalActiveSessions;

      // Check for suspicious activity patterns
      const suspiciousUsers = await User.find({
        loginAttempts: { $gte: 3 },
        lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).select('_id email loginAttempts lastLogin');

      auditResults.suspiciousActivity = suspiciousUsers.map(user => ({
        userId: user._id,
        email: user.email,
        loginAttempts: user.loginAttempts,
        lastLogin: user.lastLogin
      }));

      // Log audit results
      console.log('Daily Security Audit Results:', {
        timestamp: new Date().toISOString(),
        ...auditResults
      });

      // Alert on suspicious activity
      if (auditResults.suspiciousActivity.length > 0) {
        console.warn(`⚠️  Found ${auditResults.suspiciousActivity.length} users with suspicious login activity`);
      }

      if (auditResults.lockedUsers > auditResults.totalUsers * 0.1) { // More than 10% locked
        console.warn(`⚠️  High number of locked user accounts: ${auditResults.lockedUsers}`);
      }

      if (auditResults.activeSessions > auditResults.activeUsers * 3) { // More than 3 sessions per user average
        console.warn(`⚠️  High number of active sessions detected: ${auditResults.activeSessions}`);
      }

    } catch (error) {
      console.error('Error performing security audit:', error);
    }
  }

  /**
   * Force cleanup of all expired tokens (manual trigger)
   */
  async forceCleanupExpiredTokens(): Promise<number> {
    return await this.cleanupExpiredTokens().then(() => 0).catch(() => 0);
  }

  /**
   * Force cleanup of failed login attempts (manual trigger)
   */
  async forceCleanupFailedLoginAttempts(): Promise<void> {
    await this.cleanupFailedLoginAttempts();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: Array.from(this.cleanupTasks.keys()),
      taskCount: this.cleanupTasks.size
    };
  }
}

// Export singleton instance
export default new SecurityCleanupService();