/**
 * Token Generation and Validation Utilities
 */
const crypto = require('crypto');

class TokenUtils {
  static generateToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  static hashToken(token) {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  }

  static createVerificationToken() {
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expires = Date.now() + (parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS) || 24) * 60 * 60 * 1000;
    
    return {
      token,
      hashedToken,
      expires: new Date(expires)
    };
  }

  static createPasswordResetToken() {
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expires = Date.now() + (parseInt(process.env.PASSWORD_RESET_EXPIRY_HOURS) || 1) * 60 * 60 * 1000;
    
    return {
      token,
      hashedToken,
      expires: new Date(expires)
    };
  }

  static isTokenExpired(expiryDate) {
    return Date.now() > new Date(expiryDate).getTime();
  }

  static compareTokens(plainToken, hashedToken) {
    const hashedPlainToken = this.hashToken(plainToken);
    return hashedPlainToken === hashedToken;
  }

  static isValidTokenFormat(token) {
    return typeof token === 'string' && 
           token.length >= 32 && 
           /^[a-f0-9]+$/i.test(token);
  }
}

module.exports = TokenUtils;