/**
 * Enhanced Authentication Routes for FieldSync
 * Supports OAuth2/OIDC, MFA, SSO, and traditional authentication
 */

import express, { Request, Response } from 'express';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { advancedAuthService, requireEnhancedAuth, requireMFA } from '../modules/advancedAuthentication';
import { requireAuth, requireRole } from '../modules/authentication';
import { auditLogger } from '../middleware/auditLogger';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs for auth endpoints
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const mfaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 MFA attempts per windowMs
  message: 'Too many MFA attempts, please try again later',
});

/**
 * Traditional email/password login with MFA support
 */
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, mfaToken, rememberDevice } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Email and password are required' 
      });
    }

    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      rememberDevice: rememberDevice || false
    };

    const result = await advancedAuthService.enhancedLogin(
      email,
      password,
      mfaToken,
      deviceInfo
    );

    if (!result.success && result.requiresMFA) {
      return res.status(200).json({
        success: false,
        requiresMFA: true,
        message: 'MFA verification required'
      });
    }

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error || 'Authentication failed'
      });
    }

    // Set refresh token as httpOnly cookie
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }

    res.json({
      success: true,
      token: result.token,
      user: result.user,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Refresh access token
 */
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    const result = await advancedAuthService.refreshAccessToken(refreshToken);
    
    if (!result.success) {
      // Clear invalid refresh token cookie
      res.clearCookie('refreshToken');
      return res.status(401).json({
        success: false,
        error: result.error
      });
    }

    res.json({
      success: true,
      token: result.token
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Logout
 */
router.post('/logout', requireEnhancedAuth, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      await advancedAuthService.logout(token);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * MFA Setup - Initiate TOTP setup
 */
router.post('/mfa/setup', requireEnhancedAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { method = 'totp' } = req.body;

    const setupData = await advancedAuthService.setupMFA(userId, method);

    res.json({
      success: true,
      data: setupData,
      message: 'MFA setup initiated'
    });

  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * MFA Setup - Complete setup with verification
 */
router.post('/mfa/setup/complete', requireEnhancedAuth, mfaLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user._id;
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({
        success: false,
        error: 'Verification code is required'
      });
    }

    const success = await advancedAuthService.completeMFASetup(userId, verificationCode);

    if (success) {
      res.json({
        success: true,
        message: 'MFA setup completed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

  } catch (error) {
    console.error('MFA setup completion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * MFA Verification for login
 */
router.post('/mfa/verify', mfaLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, mfaToken, isBackupCode = false } = req.body;

    if (!email || !password || !mfaToken) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and MFA token are required'
      });
    }

    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    };

    const result = await advancedAuthService.enhancedLogin(
      email,
      password,
      mfaToken,
      deviceInfo
    );

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: result.error || 'MFA verification failed'
      });
    }

    // Set refresh token as httpOnly cookie
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
    }

    res.json({
      success: true,
      token: result.token,
      user: result.user,
      message: 'MFA verification successful'
    });

  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Google OAuth2 - Initiate
 */
router.get('/oauth2/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}));

/**
 * Google OAuth2 - Callback
 */
router.get('/oauth2/google/callback', 
  passport.authenticate('google', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
      }

      // Generate tokens for OAuth2 user
      const tokens = await advancedAuthService['generateTokens'](user, {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        provider: 'google'
      });

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${tokens.token}`;
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
    }
  }
);

/**
 * Microsoft OAuth2 - Initiate
 */
router.get('/oauth2/microsoft', passport.authenticate('microsoft'));

/**
 * Microsoft OAuth2 - Callback
 */
router.get('/oauth2/microsoft/callback',
  passport.authenticate('microsoft', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
      }

      // Generate tokens for OAuth2 user
      const tokens = await advancedAuthService['generateTokens'](user, {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        provider: 'microsoft'
      });

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${tokens.token}`;
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('Microsoft OAuth callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`);
    }
  }
);

/**
 * SAML - Initiate
 */
router.get('/saml/login', passport.authenticate('saml'));

/**
 * SAML - Callback
 */
router.post('/saml/callback',
  passport.authenticate('saml', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=saml_failed`);
      }

      // Generate tokens for SAML user
      const tokens = await advancedAuthService['generateTokens'](user, {
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        provider: 'saml'
      });

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${tokens.token}`;
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('SAML callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=saml_error`);
    }
  }
);

/**
 * Get authentication methods available
 */
router.get('/methods', (req: Request, res: Response) => {
  const methods = {
    traditional: true,
    mfa: process.env.MFA_ENABLED === 'true',
    oauth2: {
      google: process.env.GOOGLE_OAUTH_ENABLED === 'true',
      microsoft: process.env.MICROSOFT_OAUTH_ENABLED === 'true'
    },
    saml: process.env.SAML_ENABLED === 'true'
  };

  res.json({
    success: true,
    methods
  });
});

/**
 * Get current user info with auth status
 */
router.get('/me', requireEnhancedAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  
  res.json({
    success: true,
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      profile: user.profile,
      mfaEnabled: user.mfaSettings?.enabled || false,
      oauth2Providers: user.oauth2Providers?.map((p: any) => ({
        provider: p.provider,
        connected: true
      })) || []
    }
  });
});

/**
 * Admin: Get authentication metrics
 */
router.get('/admin/metrics', requireEnhancedAuth, requireRole(['Admin']), (req: Request, res: Response) => {
  const metrics = advancedAuthService.getMetrics();
  const activeSessionsCount = advancedAuthService.getActiveSessionsCount();

  res.json({
    success: true,
    metrics: {
      ...metrics,
      activeSessionsCount
    }
  });
});

/**
 * Admin: Force logout user
 */
router.post('/admin/force-logout/:userId', 
  requireEnhancedAuth, 
  requireRole(['Admin']), 
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const sessionsRevoked = await advancedAuthService.forceLogoutUser(userId);

      res.json({
        success: true,
        message: `Revoked ${sessionsRevoked} active sessions for user`,
        sessionsRevoked
      });

    } catch (error) {
      console.error('Force logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

export default router;