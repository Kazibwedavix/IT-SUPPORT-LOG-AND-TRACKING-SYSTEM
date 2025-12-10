/**
 * BUGEMA UNIVERSITY IT SUPPORT SYSTEM
 * Secure File Upload Middleware
 * 
 * Contact: itsupport.bugemauniv.ac.ug | 0784845785
 * 
 * @version 2.0.0
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directory exists
const uploadDir = 'uploads/tickets';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed file types with MIME types
const ALLOWED_FILE_TYPES = {
  'image/jpeg': '.jpg',
  'image/jpeg': '.jpeg',
  'image/png': '.png',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'application/zip': '.zip',
  'application/x-rar-compressed': '.rar'
};

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = Object.keys(ALLOWED_FILE_TYPES);
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error(
      `Invalid file type. Allowed types: ${Object.values(ALLOWED_FILE_TYPES).join(', ')}`
    );
    error.status = 400;
    return cb(error, false);
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const error = new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    error.status = 400;
    return cb(error, false);
  }

  // Check for potential malicious extensions
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = Object.values(ALLOWED_FILE_TYPES);
  
  if (!allowedExtensions.includes(ext)) {
    const error = new Error(`File extension ${ext} not allowed`);
    error.status = 400;
    return cb(error, false);
  }

  cb(null, true);
};

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create user-specific directory if needed
    const userDir = path.join(uploadDir, req.user ? req.user.id : 'anonymous');
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    // Sanitize filename
    const originalName = path.parse(file.originalname).name;
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9-_.]/g, '_');
    const ext = ALLOWED_FILE_TYPES[file.mimetype] || path.extname(file.originalname);
    
    // Generate unique filename
    const uniqueFilename = `${Date.now()}_${uuidv4().slice(0, 8)}_${sanitizedName}${ext}`;
    cb(null, uniqueFilename);
  }
});

// Create multer instance with limits and filters
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Maximum 5 files per upload
    fields: 10 // Maximum 10 non-file fields
  },
  // Security: strip EXIF data for images
  // dest: uploadDir // Uncomment to use memory storage instead
});

// Middleware to handle upload errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    let message = 'File upload error';
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum 5 files per upload';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Unexpected field in file upload';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Too many parts in multipart form';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Field name too long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Field value too long';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Too many fields in form';
        break;
    }
    
    return res.status(400).json({
      success: false,
      error: message,
      supportContact: {
        email: 'itsupport.bugemauniv.ac.ug',
        phone: '0784845785'
      }
    });
  } else if (err) {
    // An unknown error occurred
    console.error('Upload error:', err);
    return res.status(500).json({
      success: false,
      error: 'File upload failed. Please try again.',
      supportContact: {
        email: 'itsupport.bugemauniv.ac.ug',
        phone: '0784845785'
      }
    });
  }
  
  next();
};

// Utility function to clean up old files (run as cron job)
const cleanupOldFiles = async (daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const files = await fs.promises.readdir(uploadDir, { recursive: true });
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isFile() && stats.mtime < cutoffDate) {
        await fs.promises.unlink(filePath);
        console.log(`Cleaned up old file: ${filePath}`);
      }
    }
  } catch (error) {
    console.error('File cleanup error:', error);
  }
};

// Get file information utility
const getFileInfo = (file) => {
  return {
    filename: file.filename,
    originalName: file.originalname,
    path: file.path,
    size: file.size,
    mimeType: file.mimetype,
    encoding: file.encoding,
    uploadedAt: new Date()
  };
};

// Middleware to validate uploaded files
const validateUploadedFiles = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const errors = [];
  
  req.files.forEach((file, index) => {
    // Check for common security issues
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Prevent double extensions
    if (ext.includes('.')) {
      errors.push(`File ${file.originalname} has invalid extension`);
    }
    
    // Check for null bytes in filename (common attack)
    if (file.originalname.includes('\0')) {
      errors.push(`File ${file.originalname} contains invalid characters`);
    }
    
    // Check for suspicious file types
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js'];
    if (suspiciousExtensions.includes(ext)) {
      errors.push(`File type ${ext} is not allowed for security reasons`);
    }
  });
  
  if (errors.length > 0) {
    // Clean up uploaded files
    req.files.forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
    
    return res.status(400).json({
      success: false,
      errors: errors,
      supportContact: {
        email: 'itsupport.bugemauniv.ac.ug',
        phone: '0784845785'
      }
    });
  }
  
  next();
};

module.exports = {
  upload,
  handleUploadErrors,
  cleanupOldFiles,
  getFileInfo,
  validateUploadedFiles,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  uploadDir
};