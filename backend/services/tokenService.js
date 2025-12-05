/**
 * Enhanced Token Service with Graceful Redis Fallback
 * 
 * @version 2.0.0
 * @author Bugema University IT Support System
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET || 'bugema-it-support-super-secret-key-2024-change-this';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'bugema-it-support-refresh-secret-2024-change-this';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    this.issuer = process.env.JWT_ISSUER || 'bugema-it-support';
    
    // Initialize with in-memory storage (Redis will be lazy-loaded)
    this.tokenBlacklist = new Map(); // In-memory fallback
    this.redisClient = null;
    this.redisEnabled = false;
    
    // Initialize Redis only if configured (non-blocking)
    this.initRedisAsync();
  }

  /**
   * Non-blocking Redis initialization
   */
  async initRedisAsync() {
    // Only attempt Redis if URL is provided AND redis package is available
    if (process.env.REDIS_URL) {
      try {
        // Dynamically require redis (won't crash if not installed)
        const redis = require('redis');
        
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL,
          password: process.env.REDIS_PASSWORD || undefined,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > 3) {
                console.warn('⚠️ Redis connection failed after 3 attempts, using memory storage');
                this.redisEnabled = false;
                return false;
              }
              return Math.min(retries * 100, 3000);
            }
          }
        });

        // Handle Redis errors gracefully
        this.redisClient.on('error', (err) => {
          console.warn('⚠️ Redis error:', err.message);
          this.redisEnabled = false;
        });

        this.redisClient.on('connect', () => {
          console.log('✅ Redis connected for token management');
          this.redisEnabled = true;
        });

        await this.redisClient.connect();
        
      } catch (error) {
        console.warn('⚠️ Redis not available, using in-memory storage:', error.message);
        this.redisEnabled = false;
      }
    } else {
      console.log('📝 Using in-memory token storage (Redis not configured)');
    }
  }

  /**
   * Generate access and refresh tokens
   */
  generateTokens(payload) {
    const accessToken = jwt.sign(
      {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        type: 'access',
        iss: this.issuer
      },
      this.accessTokenSecret,
      { 
        expiresIn: this.accessTokenExpiry,
        algorithm: 'HS256'
      }
    );

    const refreshToken = jwt.sign(
      {
        userId: payload.userId,
        email: payload.email,
        type: 'refresh',
        iss: this.issuer
      },
      this.refreshTokenSecret,
      { 
        expiresIn: this.refreshTokenExpiry,
        algorithm: 'HS256'
      }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token with fallback blacklist check
   */
  async verifyAccessToken(token) {
    try {
      // Check if token is blacklisted (non-blocking)
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        algorithms: ['HS256']
      });

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      const errorMessage = error.message === 'Token has been revoked' 
        ? 'Token has been revoked' 
        : error.name === 'TokenExpiredError'
          ? 'Access token has expired'
          : error.name === 'JsonWebTokenError'
            ? 'Invalid access token'
            : 'Token verification failed';
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Verify refresh token with fallback blacklist check
   */
  async verifyRefreshToken(token) {
    try {
      // Check if token is blacklisted (non-blocking)
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        algorithms: ['HS256']
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      const errorMessage = error.message === 'Token has been revoked' 
        ? 'Token has been revoked' 
        : error.name === 'TokenExpiredError'
          ? 'Refresh token has expired'
          : error.name === 'JsonWebTokenError'
            ? 'Invalid refresh token'
            : 'Token verification failed';
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Blacklist/revoke a token with fallback storage
   */
  async blacklistToken(token, expirySeconds = 86400) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded) return false;

      // Calculate expiry time
      const expiryTime = Math.floor(Date.now() / 1000) + expirySeconds;

      if (this.redisEnabled && this.redisClient) {
        // Store in Redis with TTL
        await this.redisClient.set(`blacklist:${token}`, '1', {
          EX: expirySeconds
        });
        return true;
      } else {
        // Fallback to in-memory storage
        this.tokenBlacklist.set(token, {
          expires: expiryTime,
          userId: decoded.userId
        });
        
        // Auto-cleanup
        setTimeout(() => {
          this.tokenBlacklist.delete(token);
        }, expirySeconds * 1000);
        
        return true;
      }
    } catch (error) {
      console.warn('Error blacklisting token (falling back to memory):', error.message);
      
      // Emergency memory fallback
      this.tokenBlacklist.set(token, {
        expires: Math.floor(Date.now() / 1000) + expirySeconds,
        userId: 'unknown'
      });
      
      return true;
    }
  }

  /**
   * Check if token is blacklisted (with fallback)
   */
  async isTokenBlacklisted(token) {
    try {
      if (this.redisEnabled && this.redisClient) {
        const result = await this.redisClient.get(`blacklist:${token}`);
        return result === '1';
      } else {
        // Check in-memory storage
        const blacklisted = this.tokenBlacklist.get(token);
        if (blacklisted) {
          // Check if expired
          if (blacklisted.expires < Math.floor(Date.now() / 1000)) {
            this.tokenBlacklist.delete(token);
            return false;
          }
          return true;
        }
        return false;
      }
    } catch (error) {
      console.warn('Error checking token blacklist:', error.message);
      return false; // Don't block on blacklist check errors
    }
  }

  /**
   * Generate password reset token
   */
  generatePasswordResetToken(userId) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    const resetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    return {
      token: resetToken,
      hashedToken,
      expires: resetExpires
    };
  }

  /**
   * Generate email verification token
   */
  generateEmailVerificationToken(userId) {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    
    const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    return {
      token: verificationToken,
      hashedToken,
      expires
    };
  }

  /**
   * Extract token from request
   */
  extractTokenFromRequest(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.replace('Bearer ', '');
    }

    // Check cookie
    if (req.cookies?.accessToken) {
      return req.cookies.accessToken;
    }

    // Check query parameter
    if (req.query?.token) {
      return req.query.token;
    }

    return null;
  }

  /**
   * Decode token without verification
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiry(token) {
    const decoded = this.decodeToken(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  }

  /**
   * Check if token is about to expire
   */
  isTokenAboutToExpire(token, thresholdMinutes = 5) {
    const expiry = this.getTokenExpiry(token);
    if (!expiry) return false;

    const timeToExpiry = expiry - Date.now();
    return timeToExpiry < thresholdMinutes * 60 * 1000;
  }

  /**
   * Clean up expired tokens from memory
   */
  cleanupExpiredTokens() {
    const now = Math.floor(Date.now() / 1000);
    for (const [token, data] of this.tokenBlacklist.entries()) {
      if (data.expires < now) {
        this.tokenBlacklist.delete(token);
      }
    }
  }

  /**
   * Get token statistics (for monitoring)
   */
  getTokenStats() {
    return {
      redisEnabled: this.redisEnabled,
      memoryBlacklistSize: this.tokenBlacklist.size,
      issuer: this.issuer,
      accessTokenExpiry: this.accessTokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry
    };
  }
}

// Export singleton instance
module.exports = new TokenService();