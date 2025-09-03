/**
 * Advanced Authentication Module for FieldSync
 * Implements OAuth2/OIDC, MFA, SSO, and enterprise authentication features
 * Phase 4: Enhanced Authentication Implementation
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
import { Strategy as SAMLStrategy } from 'passport-saml';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import User from '../models/user';
import { monitoringService } from '../services/monitoring';
import { auditLogger } from '../middleware/auditLogger';

// Configuration interfaces
export interface OAuth2Config {
  google: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    callbackURL: string;
  };
  microsoft: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    callbackURL: string;
    tenant?: string;
  };
  saml: {
    enabled: boolean;
    entryPoint: string;
    issuer: string;
    cert: string;
    privateKey?: string;
    callbackURL: string;
  };
}

export interface MFAConfig {
  enabled: boolean;
  enforceForRoles: string[];
  backupCodesCount: number;
  totpIssuer: string;
  smsProvider?: 'twilio' | 'aws-sns';
  emailProvider?: 'nodemailer' | 'aws-ses';
}

export interface SessionConfig {
  maxSessions: number;
  sessionTimeout: number; // minutes
  refreshTokenExpiry: number; // days
  allowConcurrentSessions: boolean;
  deviceTracking: boolean;
}

export interface AuthenticationMetrics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  mfaAttempts: number;
  oauth2Logins: number;
  accountLockouts: number;
  passwordResets: number;
  securityViolations: number;
}

class AdvancedAuthenticationService {
  private oauth2Config: OAuth2Config;
  private mfaConfig: MFAConfig;
  private sessionConfig: SessionConfig;
  private metrics: AuthenticationMetrics;
  private activeSessions: Map<string, any> = new Map();
  private refreshTokens: Map<string, any> = new Map();

  constructor() {
    this.oauth2Config = this.getOAuth2Config();
    this.mfaConfig = this.getMFAConfig();
    this.sessionConfig = this.getSessionConfig();
    this.metrics = this.initializeMetrics();
    this.initializePassportStrategies();
    this.setupSessionCleanup();
  }

  private getOAuth2Config(): OAuth2Config {
    return {
      google: {
        enabled: process.env.GOOGLE_OAUTH_ENABLED === 'true',
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
      },
      microsoft: {
        enabled: process.env.MICROSOFT_OAUTH_ENABLED === 'true',
        clientId: process.env.MICROSOFT_CLIENT_ID || '',
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
        callbackURL: process.env.MICROSOFT_CALLBACK_URL || '/auth/microsoft/callback',
        tenant: process.env.MICROSOFT_TENANT || 'common'
      },
      saml: {
        enabled: process.env.SAML_ENABLED === 'true',
        entryPoint: process.env.SAML_ENTRY_POINT || '',
        issuer: process.env.SAML_ISSUER || 'fieldsync',
        cert: process.env.SAML_CERT || '',
        privateKey: process.env.SAML_PRIVATE_KEY,
        callbackURL: process.env.SAML_CALLBACK_URL || '/auth/saml/callback'
      }
    };
  }

  private getMFAConfig(): MFAConfig {
    return {
      enabled: process.env.MFA_ENABLED === 'true',
      enforceForRoles: (process.env.MFA_ENFORCE_ROLES || 'Admin,Supervisor').split(','),
      backupCodesCount: parseInt(process.env.MFA_BACKUP_CODES_COUNT || '10'),
      totpIssuer: process.env.MFA_TOTP_ISSUER || 'FieldSync',
      smsProvider: process.env.MFA_SMS_PROVIDER as 'twilio' | 'aws-sns',
      emailProvider: process.env.MFA_EMAIL_PROVIDER as 'nodemailer' | 'aws-ses'
    };
  }

  private getSessionConfig(): SessionConfig {
    return {
      maxSessions: parseInt(process.env.MAX_SESSIONS_PER_USER || '5'),
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '480'), // 8 hours
      refreshTokenExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '30'),
      allowConcurrentSessions: process.env.ALLOW_CONCURRENT_SESSIONS === 'true',
      deviceTracking: process.env.DEVICE_TRACKING_ENABLED === 'true'
    };
  }

  private initializeMetrics(): AuthenticationMetrics {
    return {
      totalLogins: 0,
      successfulLogins: 0,
      failedLogins: 0,
      mfaAttempts: 0,
      oauth2Logins: 0,
      accountLockouts: 0,
      passwordResets: 0,
      securityViolations: 0
    };
  }

  /**
   * Initialize Passport.js strategies for OAuth2/OIDC
   */
  private initializePassportStrategies(): void {
    // JWT Strategy for API authentication
    passport.use(new JwtStrategy({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'changeme',
    }, async (payload, done) => {
      try {
        const user = await User.findById(payload.id).select('-passwordHash');
        if (user && user.isActive) {
          return done(null, user);
        }
        return done(null, false);
      } catch (error) {
        return done(error, false);
      }
    }));

    // Google OAuth2 Strategy
    if (this.oauth2Config.google.enabled) {
      passport.use(new GoogleStrategy({
        clientID: this.oauth2Config.google.clientId,
        clientSecret: this.oauth2Config.google.clientSecret,
        callbackURL: this.oauth2Config.google.callbackURL,
        scope: ['profile', 'email']
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const result = await this.handleOAuth2Login('google', profile, accessToken);
          return done(null, result);
        } catch (error) {
          return done(error, null);
        }
      }));
    }

    // Microsoft OAuth2 Strategy
    if (this.oauth2Config.microsoft.enabled) {
      passport.use(new MicrosoftStrategy({
        clientID: this.oauth2Config.microsoft.clientId,
        clientSecret: this.oauth2Config.microsoft.clientSecret,
        callbackURL: this.oauth2Config.microsoft.callbackURL,
        tenant: this.oauth2Config.microsoft.tenant,
        scope: ['user.read']
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const result = await this.handleOAuth2Login('microsoft', profile, accessToken);
          return done(null, result);
        } catch (error) {
          return done(error, null);
        }
      }));
    }

    // SAML Strategy
    if (this.oauth2Config.saml.enabled) {
      passport.use(new SAMLStrategy({
        entryPoint: this.oauth2Config.saml.entryPoint,
        issuer: this.oauth2Config.saml.issuer,
        cert: this.oauth2Config.saml.cert,
        privateKey: this.oauth2Config.saml.privateKey,
        callbackUrl: this.oauth2Config.saml.callbackURL
      }, async (profile, done) => {
        try {
          const result = await this.handleSAMLLogin(profile);
          return done(null, result);
        } catch (error) {
          return done(error, null);
        }
      }));
    }
  }

  /**
   * Handle OAuth2 login from Google/Microsoft
   */
  private async handleOAuth2Login(provider: string, profile: any, accessToken: string): Promise<any> {
    const email = profile.emails?.[0]?.value || profile.email;
    const displayName = profile.displayName || `${profile.name?.givenName} ${profile.name?.familyName}`;

    if (!email) {
      throw new Error('Email not provided by OAuth2 provider');
    }

    // Check if user exists
    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Auto-provision user if allowed
      if (process.env.OAUTH2_AUTO_PROVISION === 'true') {
        user = new User({
          email: email.toLowerCase(),
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12), // Random password
          role: process.env.OAUTH2_DEFAULT_ROLE || 'FieldTech',
          profile: {
            firstName: profile.name?.givenName || displayName.split(' ')[0],
            lastName: profile.name?.familyName || displayName.split(' ').slice(1).join(' '),
            avatar: profile.photos?.[0]?.value
          },
          isActive: true,
          oauth2Providers: [{
            provider,
            providerId: profile.id,
            accessToken: this.encryptToken(accessToken)
          }]
        });
        await user.save();
        
        await auditLogger.log('user_created', user._id, {
          method: 'oauth2',
          provider,
          email: user.email
        });
      } else {
        throw new Error('User not found and auto-provisioning is disabled');
      }
    } else {
      // Update OAuth2 provider info
      const existingProvider = user.oauth2Providers?.find(p => p.provider === provider);
      if (existingProvider) {
        existingProvider.accessToken = this.encryptToken(accessToken);
        existingProvider.lastUsed = new Date();
      } else {
        if (!user.oauth2Providers) user.oauth2Providers = [];
        user.oauth2Providers.push({
          provider,
          providerId: profile.id,
          accessToken: this.encryptToken(accessToken),
          lastUsed: new Date()
        });
      }
      await user.save();
    }

    this.metrics.oauth2Logins++;
    return user;
  }

  /**
   * Handle SAML login
   */
  private async handleSAMLLogin(profile: any): Promise<any> {
    const email = profile.email || profile.nameID;
    
    if (!email) {
      throw new Error('Email not provided by SAML provider');
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      if (process.env.SAML_AUTO_PROVISION === 'true') {
        user = new User({
          email: email.toLowerCase(),
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12),
          role: profile.role || process.env.SAML_DEFAULT_ROLE || 'FieldTech',
          profile: {
            firstName: profile.firstName || profile.givenName || '',
            lastName: profile.lastName || profile.surname || '',
            department: profile.department
          },
          isActive: true,
          samlProfile: {
            nameID: profile.nameID,
            sessionIndex: profile.sessionIndex
          }
        });
        await user.save();

        await auditLogger.log('user_created', user._id, {
          method: 'saml',
          email: user.email
        });
      } else {
        throw new Error('User not found and SAML auto-provisioning is disabled');
      }
    }

    return user;
  }

  /**
   * Setup MFA for user
   */
  async setupMFA(userId: string, method: 'totp' | 'sms' | 'email'): Promise<{
    secret?: string;
    qrCode?: string;
    backupCodes?: string[];
  }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const result: any = {};

    if (method === 'totp') {
      const secret = speakeasy.generateSecret({
        name: `${this.mfaConfig.totpIssuer}:${user.email}`,
        issuer: this.mfaConfig.totpIssuer,
        length: 32
      });

      user.mfaSettings = {
        ...user.mfaSettings,
        totpSecret: this.encryptSecret(secret.base32),
        enabled: false, // Will be enabled after verification
        method: 'totp'
      };

      result.secret = secret.base32;
      result.qrCode = await qrcode.toDataURL(secret.otpauth_url!);
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(this.mfaConfig.backupCodesCount);
    user.mfaSettings = {
      ...user.mfaSettings,
      backupCodes: backupCodes.map(code => this.hashBackupCode(code)),
      backupCodesUsed: []
    };

    await user.save();
    result.backupCodes = backupCodes;

    await auditLogger.log('mfa_setup_initiated', userId, { method });
    return result;
  }

  /**
   * Verify MFA token
   */
  async verifyMFA(userId: string, token: string, isBackupCode: boolean = false): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user || !user.mfaSettings) {
      return false;
    }

    this.metrics.mfaAttempts++;

    if (isBackupCode) {
      return this.verifyBackupCode(user, token);
    }

    if (user.mfaSettings.method === 'totp' && user.mfaSettings.totpSecret) {
      const secret = this.decryptSecret(user.mfaSettings.totpSecret);
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time steps before/after
      });

      if (verified) {
        user.mfaSettings.lastUsed = new Date();
        await user.save();
        await auditLogger.log('mfa_verification_success', userId, { method: 'totp' });
      } else {
        await auditLogger.log('mfa_verification_failed', userId, { method: 'totp' });
      }

      return verified;
    }

    return false;
  }

  /**
   * Complete MFA setup
   */
  async completeMFASetup(userId: string, verificationToken: string): Promise<boolean> {
    const isValid = await this.verifyMFA(userId, verificationToken);
    
    if (isValid) {
      const user = await User.findById(userId);
      if (user && user.mfaSettings) {
        user.mfaSettings.enabled = true;
        user.mfaSettings.setupCompletedAt = new Date();
        await user.save();
        
        await auditLogger.log('mfa_setup_completed', userId, {
          method: user.mfaSettings.method
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Enhanced login with MFA support
   */
  async enhancedLogin(email: string, password: string, mfaToken?: string, deviceInfo?: any): Promise<{
    success: boolean;
    requiresMFA: boolean;
    token?: string;
    refreshToken?: string;
    user?: any;
    error?: string;
  }> {
    try {
      this.metrics.totalLogins++;

      // Basic authentication
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user || !user.isActive) {
        this.metrics.failedLogins++;
        await auditLogger.log('login_failed', null, { email, reason: 'user_not_found' });
        return { success: false, requiresMFA: false, error: 'Invalid credentials' };
      }

      // Check account lockout
      if (user.lockUntil && user.lockUntil > new Date()) {
        this.metrics.accountLockouts++;
        await auditLogger.log('login_blocked', user._id, { reason: 'account_locked' });
        return { success: false, requiresMFA: false, error: 'Account locked' };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        user.loginAttempts += 1;
        if (user.loginAttempts >= 5) {
          user.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
          this.metrics.accountLockouts++;
        }
        await user.save();
        
        this.metrics.failedLogins++;
        await auditLogger.log('login_failed', user._id, { reason: 'invalid_password' });
        return { success: false, requiresMFA: false, error: 'Invalid credentials' };
      }

      // Check if MFA is required
      const requiresMFA = this.isMFARequired(user);
      
      if (requiresMFA && !mfaToken) {
        return { success: false, requiresMFA: true };
      }

      if (requiresMFA && mfaToken) {
        const mfaValid = await this.verifyMFA(user._id, mfaToken);
        if (!mfaValid) {
          this.metrics.failedLogins++;
          await auditLogger.log('mfa_verification_failed', user._id, {});
          return { success: false, requiresMFA: true, error: 'Invalid MFA token' };
        }
      }

      // Generate tokens
      const tokens = await this.generateTokens(user, deviceInfo);
      
      // Reset login attempts
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      user.lastLogin = new Date();
      await user.save();

      // Track session
      await this.trackSession(user._id, tokens.token, deviceInfo);

      this.metrics.successfulLogins++;
      await auditLogger.log('login_success', user._id, {
        mfaUsed: requiresMFA,
        deviceInfo
      });

      return {
        success: true,
        requiresMFA: false,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          mfaEnabled: user.mfaSettings?.enabled || false
        }
      };

    } catch (error) {
      console.error('Enhanced login error:', error);
      this.metrics.failedLogins++;
      return { success: false, requiresMFA: false, error: 'Internal server error' };
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: any, deviceInfo?: any): Promise<{
    token: string;
    refreshToken: string;
  }> {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      sessionId: crypto.randomBytes(16).toString('hex')
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'changeme', {
      expiresIn: `${this.sessionConfig.sessionTimeout}m`
    });

    const refreshToken = jwt.sign(
      { userId: user._id, sessionId: payload.sessionId },
      process.env.REFRESH_TOKEN_SECRET || 'changeme-refresh',
      { expiresIn: `${this.sessionConfig.refreshTokenExpiry}d` }
    );

    // Store refresh token
    this.refreshTokens.set(refreshToken, {
      userId: user._id,
      sessionId: payload.sessionId,
      createdAt: new Date(),
      deviceInfo
    });

    return { token, refreshToken };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    success: boolean;
    token?: string;
    error?: string;
  }> {
    try {
      const tokenData = this.refreshTokens.get(refreshToken);
      if (!tokenData) {
        return { success: false, error: 'Invalid refresh token' };
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET || 'changeme-refresh') as any;
      
      if (decoded.userId !== tokenData.userId.toString()) {
        this.refreshTokens.delete(refreshToken);
        return { success: false, error: 'Invalid refresh token' };
      }

      // Get user
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        this.refreshTokens.delete(refreshToken);
        return { success: false, error: 'User not found or inactive' };
      }

      // Generate new access token
      const newToken = jwt.sign({
        id: user._id,
        email: user.email,
        role: user.role,
        sessionId: decoded.sessionId
      }, process.env.JWT_SECRET || 'changeme', {
        expiresIn: `${this.sessionConfig.sessionTimeout}m`
      });

      await auditLogger.log('token_refreshed', user._id, {
        sessionId: decoded.sessionId
      });

      return { success: true, token: newToken };

    } catch (error) {
      return { success: false, error: 'Invalid refresh token' };
    }
  }

  /**
   * Track active session
   */
  private async trackSession(userId: string, token: string, deviceInfo?: any): Promise<void> {
    const sessionId = this.extractSessionId(token);
    if (!sessionId) return;

    const sessionData = {
      userId,
      sessionId,
      token,
      createdAt: new Date(),
      lastActivity: new Date(),
      deviceInfo: deviceInfo || {},
      isActive: true
    };

    this.activeSessions.set(sessionId, sessionData);

    // Enforce max sessions per user
    if (this.sessionConfig.maxSessions > 0) {
      await this.enforceMaxSessions(userId);
    }
  }

  /**
   * Enforce maximum sessions per user
   */
  private async enforceMaxSessions(userId: string): Promise<void> {
    const userSessions = Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    if (userSessions.length > this.sessionConfig.maxSessions) {
      const sessionsToRevoke = userSessions.slice(this.sessionConfig.maxSessions);
      
      for (const session of sessionsToRevoke) {
        this.activeSessions.delete(session.sessionId);
        await auditLogger.log('session_revoked', userId, {
          sessionId: session.sessionId,
          reason: 'max_sessions_exceeded'
        });
      }
    }
  }

  /**
   * Logout and revoke session
   */
  async logout(token: string): Promise<boolean> {
    try {
      const sessionId = this.extractSessionId(token);
      if (sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (session) {
          this.activeSessions.delete(sessionId);
          await auditLogger.log('logout', session.userId, { sessionId });
        }
      }
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  /**
   * Utility methods
   */
  private isMFARequired(user: any): boolean {
    if (!this.mfaConfig.enabled) return false;
    if (!user.mfaSettings?.enabled) return false;
    return this.mfaConfig.enforceForRoles.includes(user.role);
  }

  private verifyBackupCode(user: any, code: string): boolean {
    if (!user.mfaSettings?.backupCodes) return false;

    const hashedCode = this.hashBackupCode(code);
    const codeIndex = user.mfaSettings.backupCodes.indexOf(hashedCode);
    
    if (codeIndex !== -1 && !user.mfaSettings.backupCodesUsed.includes(codeIndex)) {
      user.mfaSettings.backupCodesUsed.push(codeIndex);
      user.save();
      return true;
    }
    
    return false;
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private encryptToken(token: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY || 'changeme');
    return cipher.update(token, 'utf8', 'hex') + cipher.final('hex');
  }

  private encryptSecret(secret: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY || 'changeme');
    return cipher.update(secret, 'utf8', 'hex') + cipher.final('hex');
  }

  private decryptSecret(encryptedSecret: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY || 'changeme');
    return decipher.update(encryptedSecret, 'hex', 'utf8') + decipher.final('utf8');
  }

  private extractSessionId(token: string): string | null {
    try {
      const decoded = jwt.decode(token) as any;
      return decoded?.sessionId || null;
    } catch {
      return null;
    }
  }

  private setupSessionCleanup(): void {
    // Clean up expired sessions every 30 minutes
    setInterval(() => {
      const now = new Date();
      const timeoutMs = this.sessionConfig.sessionTimeout * 60 * 1000;

      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (now.getTime() - session.lastActivity.getTime() > timeoutMs) {
          this.activeSessions.delete(sessionId);
        }
      }

      // Clean up expired refresh tokens
      for (const [token, data] of this.refreshTokens.entries()) {
        const ageMs = now.getTime() - data.createdAt.getTime();
        const maxAgeMs = this.sessionConfig.refreshTokenExpiry * 24 * 60 * 60 * 1000;
        if (ageMs > maxAgeMs) {
          this.refreshTokens.delete(token);
        }
      }
    }, 30 * 60 * 1000);
  }

  /**
   * Get authentication metrics
   */
  getMetrics(): AuthenticationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Admin: Force logout user
   */
  async forceLogoutUser(userId: string): Promise<number> {
    const userSessions = Array.from(this.activeSessions.entries())
      .filter(([, session]) => session.userId === userId);

    for (const [sessionId] of userSessions) {
      this.activeSessions.delete(sessionId);
    }

    await auditLogger.log('force_logout', userId, {
      sessionCount: userSessions.length
    });

    return userSessions.length;
  }
}

// Export singleton instance
export const advancedAuthService = new AdvancedAuthenticationService();

// Export middleware functions
export const requireEnhancedAuth = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false })(req, res, next);
};

export const requireMFA = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (user && advancedAuthService['isMFARequired'](user) && !req.headers['x-mfa-verified']) {
    return res.status(401).json({ error: 'MFA verification required' });
  }
  next();
};

export default advancedAuthService;