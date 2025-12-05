/**
 * Enterprise Validation System
 * 
 * Comprehensive validation utilities for the Bugema University IT Support System.
 * Provides robust input validation, data sanitization, and security checks.
 * 
 * @module validation
 * @author IT Support Team
 * @version 2.0.0
 * @since 2024-01-15
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Indicates if validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 * @property {Object} sanitizedData - Cleaned and sanitized data
 */

/**
 * @typedef {Object} ValidationRule
 * @property {string} field - Field name
 * @property {string} type - Data type to validate
 * @property {boolean} required - Whether field is required
 * @property {number} minLength - Minimum length for strings/arrays
 * @property {number} maxLength - Maximum length for strings/arrays
 * @property {number} min - Minimum value for numbers
 * @property {number} max - Maximum value for numbers
 * @property {RegExp} pattern - Regular expression pattern
 * @property {Array} enumValues - Allowed enum values
 * @property {Function} customValidator - Custom validation function
 * @property {string} errorMessage - Custom error message
 */

/**
 * Ticket Data Validation
 * Validates all ticket-related data with strict business rules
 */
class TicketValidator {
    /**
     * Ticket status enumeration
     * Defines all valid ticket statuses in the system
     */
    static VALID_STATUSES = [
        'open',
        'in-progress',
        'awaiting-user',
        'resolved',
        'closed'
    ];

    /**
     * Ticket urgency levels
     * Defines all valid urgency levels
     */
    static VALID_URGENCIES = [
        'low',
        'medium',
        'high',
        'critical'
    ];

    /**
     * Ticket issue types
     * Defines all valid issue types in the system
     */
    static VALID_ISSUE_TYPES = [
        'hardware',
        'software',
        'network',
        'account',
        'security',
        'other'
    ];

    /**
     * Priority levels mapping
     * Maps urgency levels to SLA timeframes (hours)
     */
    static PRIORITY_TIMEFRAMES = {
        'low': 72,
        'medium': 48,
        'high': 24,
        'critical': 4
    };

    /**
     * Maximum file size for attachments (10MB)
     */
    static MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    /**
     * Allowed file types for attachments
     */
    static ALLOWED_FILE_TYPES = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
    ];

    /**
     * Validates a complete ticket creation/update payload
     * 
     * @param {Object} ticketData - Raw ticket data from client
     * @param {boolean} isUpdate - Whether this is an update operation
     * @returns {ValidationResult} Validation result with errors and sanitized data
     */
    static validateTicketData(ticketData, isUpdate = false) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            sanitizedData: {}
        };

        // Ensure we have data to validate
        if (!ticketData || typeof ticketData !== 'object') {
            result.valid = false;
            result.errors.push('Ticket data is required and must be an object');
            return result;
        }

        // Create a copy to avoid mutating original data
        const data = { ...ticketData };

        // Validate required fields for new tickets
        if (!isUpdate) {
            const requiredFields = ['title', 'description', 'issueType'];
            for (const field of requiredFields) {
                if (!data[field] || data[field].toString().trim() === '') {
                    result.valid = false;
                    result.errors.push(`${this.formatFieldName(field)} is required`);
                }
            }
        }

        // If we already have errors, return early to avoid further processing
        if (result.errors.length > 0) {
            return result;
        }

        // Validate individual fields
        this.validateTitle(data.title, result);
        this.validateDescription(data.description, result);
        this.validateIssueType(data.issueType, result);
        this.validateUrgency(data.urgency, result);
        this.validateStatus(data.status, result, isUpdate);
        this.validateCategory(data.category, result);
        this.validateDepartment(data.department, result);
        this.validateLocation(data.location, result);
        this.validateContactInfo(data.contactInfo, result);
        this.validateAttachments(data.attachments, result);
        this.validateMetadata(data.metadata, result);

        // Validate related entities if present
        if (data.assignedTo) {
            this.validateUserId(data.assignedTo, 'assignedTo', result);
        }

        if (data.createdBy) {
            this.validateUserId(data.createdBy, 'createdBy', result);
        }

        // Set default values for missing optional fields
        if (!data.urgency) {
            result.sanitizedData.urgency = 'medium';
        }

        if (!data.status && !isUpdate) {
            result.sanitizedData.status = 'open';
        }

        // Set createdAt for new tickets
        if (!isUpdate && !data.createdAt) {
            result.sanitizedData.createdAt = new Date().toISOString();
        }

        // Set updatedAt for all tickets
        result.sanitizedData.updatedAt = new Date().toISOString();

        // Only return sanitized data if validation passed
        if (result.valid) {
            result.sanitizedData = {
                ...result.sanitizedData,
                title: data.title?.trim(),
                description: data.description?.trim(),
                issueType: data.issueType,
                urgency: data.urgency || 'medium',
                status: data.status || 'open',
                ...(data.category && { category: data.category.trim() }),
                ...(data.department && { department: data.department.trim() }),
                ...(data.location && { location: data.location.trim() }),
                ...(data.contactInfo && { contactInfo: this.sanitizeContactInfo(data.contactInfo) }),
                ...(data.assignedTo && { assignedTo: data.assignedTo }),
                ...(data.createdBy && { createdBy: data.createdBy }),
                ...(data.metadata && { metadata: this.sanitizeMetadata(data.metadata) })
            };
        }

        return result;
    }

    /**
     * Validates ticket title
     * 
     * @param {string} title - Ticket title
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateTitle(title, result) {
        if (!title) return;

        const trimmedTitle = title.toString().trim();
        
        if (trimmedTitle.length < 5) {
            result.valid = false;
            result.errors.push('Title must be at least 5 characters long');
        }

        if (trimmedTitle.length > 200) {
            result.valid = false;
            result.errors.push('Title cannot exceed 200 characters');
        }

        // Check for malicious content
        if (this.containsMaliciousContent(trimmedTitle)) {
            result.valid = false;
            result.errors.push('Title contains suspicious content');
        }
    }

    /**
     * Validates ticket description
     * 
     * @param {string} description - Ticket description
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateDescription(description, result) {
        if (!description) return;

        const trimmedDescription = description.toString().trim();
        
        if (trimmedDescription.length < 10) {
            result.valid = false;
            result.errors.push('Description must be at least 10 characters long');
        }

        if (trimmedDescription.length > 5000) {
            result.valid = false;
            result.errors.push('Description cannot exceed 5000 characters');
        }

        // Check for malicious content
        if (this.containsMaliciousContent(trimmedDescription)) {
            result.valid = false;
            result.errors.push('Description contains suspicious content');
        }

        // Check for minimum information
        const wordCount = trimmedDescription.split(/\s+/).length;
        if (wordCount < 5) {
            result.warnings.push('Description seems brief. Please provide more details for better support.');
        }
    }

    /**
     * Validates issue type
     * 
     * @param {string} issueType - Issue type
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateIssueType(issueType, result) {
        if (!issueType) return;

        if (!this.VALID_ISSUE_TYPES.includes(issueType.toLowerCase())) {
            result.valid = false;
            result.errors.push(
                `Issue type must be one of: ${this.VALID_ISSUE_TYPES.join(', ')}`
            );
        }
    }

    /**
     * Validates urgency level
     * 
     * @param {string} urgency - Urgency level
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateUrgency(urgency, result) {
        if (!urgency) return;

        const lowerUrgency = urgency.toLowerCase();
        
        if (!this.VALID_URGENCIES.includes(lowerUrgency)) {
            result.valid = false;
            result.errors.push(
                `Urgency must be one of: ${this.VALID_URGENCIES.join(', ')}`
            );
        }

        // Log warning for critical urgency (requires review)
        if (lowerUrgency === 'critical') {
            result.warnings.push(
                'Critical urgency tickets require immediate attention and supervisor approval.'
            );
        }
    }

    /**
     * Validates ticket status
     * 
     * @param {string} status - Ticket status
     * @param {ValidationResult} result - Validation result object to update
     * @param {boolean} isUpdate - Whether this is an update operation
     */
    static validateStatus(status, result, isUpdate) {
        if (!status) return;

        const lowerStatus = status.toLowerCase();
        
        if (!this.VALID_STATUSES.includes(lowerStatus)) {
            result.valid = false;
            result.errors.push(
                `Status must be one of: ${this.VALID_STATUSES.join(', ')}`
            );
        }

        // Business rule: Cannot reopen closed tickets without authorization
        if (isUpdate && lowerStatus === 'open') {
            result.warnings.push(
                'Reopening a closed ticket requires additional authorization.'
            );
        }
    }

    /**
     * Validates ticket category
     * 
     * @param {string} category - Ticket category
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateCategory(category, result) {
        if (!category) return;

        const trimmedCategory = category.toString().trim();
        
        if (trimmedCategory.length > 100) {
            result.valid = false;
            result.errors.push('Category cannot exceed 100 characters');
        }
    }

    /**
     * Validates department
     * 
     * @param {string} department - Department name
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateDepartment(department, result) {
        if (!department) return;

        const trimmedDepartment = department.toString().trim();
        
        if (trimmedDepartment.length > 100) {
            result.valid = false;
            result.errors.push('Department cannot exceed 100 characters');
        }

        // Validate against known departments
        const validDepartments = [
            'IT Support',
            'Academic Affairs',
            'Administration',
            'Finance',
            'Human Resources',
            'Student Services',
            'Facilities',
            'Library'
        ];

        if (!validDepartments.includes(trimmedDepartment)) {
            result.warnings.push(
                `Department "${trimmedDepartment}" is not in the standard list.`
            );
        }
    }

    /**
     * Validates location information
     * 
     * @param {string} location - Location details
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateLocation(location, result) {
        if (!location) return;

        const trimmedLocation = location.toString().trim();
        
        if (trimmedLocation.length > 200) {
            result.valid = false;
            result.errors.push('Location cannot exceed 200 characters');
        }
    }

    /**
     * Validates contact information
     * 
     * @param {Object|string} contactInfo - Contact information
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateContactInfo(contactInfo, result) {
        if (!contactInfo) return;

        if (typeof contactInfo === 'string') {
            const trimmedContact = contactInfo.trim();
            
            if (trimmedContact.length > 100) {
                result.valid = false;
                result.errors.push('Contact information cannot exceed 100 characters');
            }

            // Basic email validation if it looks like an email
            if (trimmedContact.includes('@')) {
                if (!this.isValidEmail(trimmedContact)) {
                    result.warnings.push('Contact information appears to be an email but format is invalid');
                }
            }
        } else if (typeof contactInfo === 'object') {
            // Validate structured contact info
            if (contactInfo.email && !this.isValidEmail(contactInfo.email)) {
                result.valid = false;
                result.errors.push('Invalid email address in contact information');
            }

            if (contactInfo.phone) {
                const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
                if (!phoneRegex.test(contactInfo.phone.replace(/\D/g, ''))) {
                    result.warnings.push('Phone number format appears invalid');
                }
            }
        }
    }

    /**
     * Validates file attachments
     * 
     * @param {Array} attachments - File attachments
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateAttachments(attachments, result) {
        if (!attachments || !Array.isArray(attachments)) return;

        // Limit number of attachments
        if (attachments.length > 10) {
            result.valid = false;
            result.errors.push('Cannot attach more than 10 files');
            return;
        }

        attachments.forEach((attachment, index) => {
            if (!attachment || typeof attachment !== 'object') {
                result.errors.push(`Attachment ${index + 1} is invalid`);
                return;
            }

            // Validate file name
            if (!attachment.name || attachment.name.trim() === '') {
                result.errors.push(`Attachment ${index + 1} has no file name`);
            }

            // Validate file size
            if (attachment.size > this.MAX_FILE_SIZE) {
                result.valid = false;
                result.errors.push(
                    `Attachment "${attachment.name}" exceeds maximum file size of 10MB`
                );
            }

            // Validate file type
            if (attachment.type && !this.ALLOWED_FILE_TYPES.includes(attachment.type)) {
                result.valid = false;
                result.errors.push(
                    `File type "${attachment.type}" is not allowed for attachment "${attachment.name}"`
                );
            }

            // Check for malicious file names
            if (attachment.name && this.containsMaliciousContent(attachment.name)) {
                result.valid = false;
                result.errors.push(`Attachment name "${attachment.name}" contains suspicious characters`);
            }
        });
    }

    /**
     * Validates metadata object
     * 
     * @param {Object} metadata - Metadata object
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateMetadata(metadata, result) {
        if (!metadata || typeof metadata !== 'object') return;

        // Limit metadata size
        const metadataStr = JSON.stringify(metadata);
        if (metadataStr.length > 5000) {
            result.valid = false;
            result.errors.push('Metadata exceeds maximum size of 5KB');
            return;
        }

        // Validate metadata keys
        const reservedKeys = ['_id', 'createdAt', 'updatedAt', '__v'];
        for (const key in metadata) {
            if (reservedKeys.includes(key)) {
                result.valid = false;
                result.errors.push(`Metadata key "${key}" is reserved`);
            }

            // Check for suspicious key names
            if (this.containsMaliciousContent(key)) {
                result.valid = false;
                result.errors.push(`Metadata key "${key}" contains suspicious characters`);
            }

            // Limit value size
            if (typeof metadata[key] === 'string' && metadata[key].length > 1000) {
                result.valid = false;
                result.errors.push(`Metadata value for "${key}" exceeds maximum length of 1000 characters`);
            }
        }
    }

    /**
     * Validates user ID format
     * 
     * @param {string} userId - User ID to validate
     * @param {string} fieldName - Field name for error messages
     * @param {ValidationResult} result - Validation result object to update
     */
    static validateUserId(userId, fieldName, result) {
        if (!userId) return;

        const userIdStr = userId.toString().trim();
        
        // MongoDB ObjectId pattern (24 hex characters)
        const objectIdPattern = /^[0-9a-fA-F]{24}$/;
        
        // UUID v4 pattern
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (!objectIdPattern.test(userIdStr) && !uuidPattern.test(userIdStr)) {
            result.valid = false;
            result.errors.push(`${this.formatFieldName(fieldName)} must be a valid user ID`);
        }
    }

    /**
     * Validates ticket filters for search and listing
     * 
     * @param {Object} filters - Filter parameters
     * @returns {ValidationResult} Validation result
     */
    static validateTicketFilters(filters) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            sanitizedData: {}
        };

        if (!filters || typeof filters !== 'object') {
            return result;
        }

        const sanitizedFilters = {};

        // Validate and sanitize each filter
        if (filters.status) {
            if (this.VALID_STATUSES.includes(filters.status.toLowerCase())) {
                sanitizedFilters.status = filters.status.toLowerCase();
            } else {
                result.errors.push(`Invalid status filter: ${filters.status}`);
            }
        }

        if (filters.urgency) {
            if (this.VALID_URGENCIES.includes(filters.urgency.toLowerCase())) {
                sanitizedFilters.urgency = filters.urgency.toLowerCase();
            } else {
                result.errors.push(`Invalid urgency filter: ${filters.urgency}`);
            }
        }

        if (filters.issueType) {
            if (this.VALID_ISSUE_TYPES.includes(filters.issueType.toLowerCase())) {
                sanitizedFilters.issueType = filters.issueType.toLowerCase();
            } else {
                result.errors.push(`Invalid issue type filter: ${filters.issueType}`);
            }
        }

        if (filters.search) {
            const searchTerm = filters.search.toString().trim();
            
            if (searchTerm.length > 100) {
                result.errors.push('Search term cannot exceed 100 characters');
            } else if (searchTerm.length > 0) {
                sanitizedFilters.search = searchTerm;
            }
        }

        if (filters.dateFrom) {
            const dateFrom = new Date(filters.dateFrom);
            if (!isNaN(dateFrom.getTime())) {
                sanitizedFilters.dateFrom = dateFrom.toISOString();
            } else {
                result.errors.push('Invalid start date format');
            }
        }

        if (filters.dateTo) {
            const dateTo = new Date(filters.dateTo);
            if (!isNaN(dateTo.getTime())) {
                sanitizedFilters.dateTo = dateTo.toISOString();
                
                // Validate date range
                if (sanitizedFilters.dateFrom && dateTo < new Date(sanitizedFilters.dateFrom)) {
                    result.errors.push('End date cannot be before start date');
                }
            } else {
                result.errors.push('Invalid end date format');
            }
        }

        if (filters.page) {
            const page = parseInt(filters.page);
            if (!isNaN(page) && page > 0) {
                sanitizedFilters.page = page;
            } else {
                result.errors.push('Page must be a positive number');
            }
        }

        if (filters.limit) {
            const limit = parseInt(filters.limit);
            if (!isNaN(limit) && limit > 0 && limit <= 100) {
                sanitizedFilters.limit = limit;
            } else {
                result.errors.push('Limit must be between 1 and 100');
            }
        }

        if (filters.sortBy) {
            const validSortFields = ['createdAt', 'updatedAt', 'title', 'urgency', 'status'];
            if (validSortFields.includes(filters.sortBy)) {
                sanitizedFilters.sortBy = filters.sortBy;
            } else {
                result.errors.push(`Invalid sort field: ${filters.sortBy}`);
            }
        }

        if (filters.sortOrder) {
            const lowerOrder = filters.sortOrder.toLowerCase();
            if (lowerOrder === 'asc' || lowerOrder === 'desc') {
                sanitizedFilters.sortOrder = lowerOrder;
            } else {
                result.errors.push('Sort order must be "asc" or "desc"');
            }
        }

        // Set default values
        if (!sanitizedFilters.page) sanitizedFilters.page = 1;
        if (!sanitizedFilters.limit) sanitizedFilters.limit = 10;
        if (!sanitizedFilters.sortBy) sanitizedFilters.sortBy = 'createdAt';
        if (!sanitizedFilters.sortOrder) sanitizedFilters.sortOrder = 'desc';

        result.valid = result.errors.length === 0;
        result.sanitizedData = sanitizedFilters;

        return result;
    }

    /**
     * Validates ticket comment data
     * 
     * @param {Object} commentData - Comment data
     * @returns {ValidationResult} Validation result
     */
    static validateComment(commentData) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            sanitizedData: {}
        };

        if (!commentData || typeof commentData !== 'object') {
            result.valid = false;
            result.errors.push('Comment data is required');
            return result;
        }

        // Validate content
        if (!commentData.content || commentData.content.toString().trim() === '') {
            result.valid = false;
            result.errors.push('Comment content is required');
        } else {
            const content = commentData.content.toString().trim();
            
            if (content.length < 1) {
                result.valid = false;
                result.errors.push('Comment cannot be empty');
            }

            if (content.length > 2000) {
                result.valid = false;
                result.errors.push('Comment cannot exceed 2000 characters');
            }

            if (this.containsMaliciousContent(content)) {
                result.valid = false;
                result.errors.push('Comment contains suspicious content');
            }

            result.sanitizedData.content = content;
        }

        // Validate author if provided
        if (commentData.author) {
            this.validateUserId(commentData.author, 'author', result);
            if (result.valid) {
                result.sanitizedData.author = commentData.author;
            }
        }

        // Validate internal flag
        if (commentData.isInternal !== undefined) {
            if (typeof commentData.isInternal !== 'boolean') {
                result.valid = false;
                result.errors.push('isInternal must be a boolean value');
            } else {
                result.sanitizedData.isInternal = commentData.isInternal;
            }
        }

        // Set timestamps
        result.sanitizedData.createdAt = new Date().toISOString();
        result.sanitizedData.updatedAt = new Date().toISOString();

        return result;
    }

    /**
     * Validates bulk operation data
     * 
     * @param {Object} bulkData - Bulk operation data
     * @returns {ValidationResult} Validation result
     */
    static validateBulkOperation(bulkData) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            sanitizedData: {}
        };

        if (!bulkData || typeof bulkData !== 'object') {
            result.valid = false;
            result.errors.push('Bulk operation data is required');
            return result;
        }

        // Validate ticket IDs
        if (!bulkData.ticketIds || !Array.isArray(bulkData.ticketIds)) {
            result.valid = false;
            result.errors.push('ticketIds must be an array');
        } else if (bulkData.ticketIds.length === 0) {
            result.valid = false;
            result.errors.push('At least one ticket ID is required');
        } else if (bulkData.ticketIds.length > 100) {
            result.valid = false;
            result.errors.push('Cannot process more than 100 tickets at once');
        } else {
            // Validate each ticket ID
            const validTicketIds = [];
            bulkData.ticketIds.forEach((id, index) => {
                if (!id || typeof id !== 'string') {
                    result.errors.push(`Ticket ID at position ${index} is invalid`);
                } else {
                    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
                    if (!objectIdPattern.test(id)) {
                        result.errors.push(`Invalid ticket ID format at position ${index}`);
                    } else {
                        validTicketIds.push(id);
                    }
                }
            });

            result.sanitizedData.ticketIds = validTicketIds;
        }

        // Validate action
        if (!bulkData.action || typeof bulkData.action !== 'string') {
            result.valid = false;
            result.errors.push('Action is required');
        } else {
            const validActions = ['in-progress', 'resolved', 'closed', 'reopen'];
            if (!validActions.includes(bulkData.action.toLowerCase())) {
                result.valid = false;
                result.errors.push(
                    `Action must be one of: ${validActions.join(', ')}`
                );
            } else {
                result.sanitizedData.action = bulkData.action.toLowerCase();
            }
        }

        // Validate notes (optional)
        if (bulkData.notes) {
            const notes = bulkData.notes.toString().trim();
            if (notes.length > 500) {
                result.valid = false;
                result.errors.push('Notes cannot exceed 500 characters');
            } else if (this.containsMaliciousContent(notes)) {
                result.valid = false;
                result.errors.push('Notes contain suspicious content');
            } else {
                result.sanitizedData.notes = notes;
            }
        }

        // Set performer and timestamp
        result.sanitizedData.performedAt = new Date().toISOString();

        return result;
    }

    /**
     * Utility Methods
     */

    /**
     * Formats field names for display in error messages
     * 
     * @param {string} fieldName - Raw field name
     * @returns {string} Formatted field name
     */
    static formatFieldName(fieldName) {
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    /**
     * Checks if text contains potentially malicious content
     * 
     * @param {string} text - Text to check
     * @returns {boolean} True if malicious content detected
     */
    static containsMaliciousContent(text) {
        if (!text || typeof text !== 'string') return false;

        const maliciousPatterns = [
            /<script\b[^>]*>/i,                    // Script tags
            /javascript:/i,                        // JavaScript protocol
            /on\w+\s*=/i,                          // Event handlers
            /data:/i,                              // Data URIs
            /vbscript:/i,                          // VBScript
            /expression\s*\(/i,                    // CSS expressions
            /eval\s*\(/i,                          // Eval function
            /alert\s*\(/i,                         // Alert function
            /document\./i,                         // Document object
            /window\./i,                           // Window object
            /localStorage\./i,                     // Local storage
            /sessionStorage\./i,                   // Session storage
            /\.innerHTML/i,                        // InnerHTML
            /\.outerHTML/i,                        // OuterHTML
            /\.write\s*\(/i,                       // Document write
            /fromCharCode\s*\(/i,                  // FromCharCode
            /base64_decode/i,                      // Base64 decode
            /union\s+select/i,                     // SQL injection
            /select\s+\*\s+from/i,                 // SQL injection
            /insert\s+into/i,                      // SQL injection
            /drop\s+table/i,                       // SQL injection
            /delete\s+from/i,                      // SQL injection
            /or\s+1=1/i,                           // SQL injection
            /';/i,                                 // SQL injection
            /\/\*.*\*\//i,                         // SQL comments
            /--/i,                                 // SQL comments
            /<\?php/i,                             // PHP tags
            /<\?=/i,                               // PHP short tags
            /<\?.*\?>/i,                           // PHP tags
            /system\s*\(/i,                        // System calls
            /exec\s*\(/i,                          // Exec calls
            /shell_exec\s*\(/i,                    // Shell exec
            /passthru\s*\(/i,                      // Passthru
            /proc_open\s*\(/i,                     // Proc open
            /popen\s*\(/i                          // Popen
        ];

        for (const pattern of maliciousPatterns) {
            if (pattern.test(text)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validates email address format
     * 
     * @param {string} email - Email address to validate
     * @returns {boolean} True if email is valid
     */
    static isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;

        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!emailRegex.test(email)) {
            return false;
        }

        // Additional checks
        if (email.length > 254) return false; // RFC 5321 limit
        
        const parts = email.split('@');
        if (parts[0].length > 64) return false; // Local part limit
        
        const domain = parts[1];
        if (domain.length > 253) return false; // Domain limit
        
        // Check for consecutive dots
        if (email.includes('..')) return false;
        
        // Check for spaces
        if (email.includes(' ')) return false;

        return true;
    }

    /**
     * Sanitizes contact information object
     * 
     * @param {Object} contactInfo - Contact information
     * @returns {Object} Sanitized contact information
     */
    static sanitizeContactInfo(contactInfo) {
        if (!contactInfo || typeof contactInfo !== 'object') {
            return {};
        }

        const sanitized = {};

        if (contactInfo.email && this.isValidEmail(contactInfo.email)) {
            sanitized.email = contactInfo.email.trim().toLowerCase();
        }

        if (contactInfo.phone) {
            // Remove all non-digit characters except leading +
            sanitized.phone = contactInfo.phone.toString().replace(/[^\d+]/g, '');
        }

        if (contactInfo.name) {
            sanitized.name = contactInfo.name.toString().trim().substring(0, 100);
        }

        if (contactInfo.department) {
            sanitized.department = contactInfo.department.toString().trim().substring(0, 100);
        }

        return sanitized;
    }

    /**
     * Sanitizes metadata object
     * 
     * @param {Object} metadata - Metadata object
     * @returns {Object} Sanitized metadata
     */
    static sanitizeMetadata(metadata) {
        if (!metadata || typeof metadata !== 'object') {
            return {};
        }

        const sanitized = {};
        const reservedKeys = ['_id', 'createdAt', 'updatedAt', '__v'];

        for (const key in metadata) {
            if (reservedKeys.includes(key)) continue;
            
            // Skip if key contains malicious content
            if (this.containsMaliciousContent(key)) continue;

            const value = metadata[key];
            
            // Only allow primitive values and simple arrays/objects
            if (
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean' ||
                value === null
            ) {
                if (typeof value === 'string') {
                    const sanitizedValue = value.trim().substring(0, 1000);
                    if (!this.containsMaliciousContent(sanitizedValue)) {
                        sanitized[key] = sanitizedValue;
                    }
                } else {
                    sanitized[key] = value;
                }
            }
        }

        return sanitized;
    }

    /**
     * Calculates SLA due date based on urgency
     * 
     * @param {string} urgency - Urgency level
     * @param {Date} startDate - Start date (defaults to now)
     * @returns {Date|null} Due date or null if invalid urgency
     */
    static calculateSLADueDate(urgency, startDate = new Date()) {
        if (!this.PRIORITY_TIMEFRAMES[urgency]) {
            return null;
        }

        const dueDate = new Date(startDate);
        dueDate.setHours(dueDate.getHours() + this.PRIORITY_TIMEFRAMES[urgency]);
        
        return dueDate;
    }

    /**
     * Validates if a due date is reasonable
     * 
     * @param {Date} dueDate - Proposed due date
     * @param {string} urgency - Ticket urgency
     * @returns {ValidationResult} Validation result
     */
    static validateDueDate(dueDate, urgency) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            sanitizedData: {}
        };

        if (!dueDate) {
            return result;
        }

        const date = new Date(dueDate);
        const now = new Date();

        if (isNaN(date.getTime())) {
            result.valid = false;
            result.errors.push('Invalid due date format');
            return result;
        }

        // Due date cannot be in the past
        if (date < now) {
            result.valid = false;
            result.errors.push('Due date cannot be in the past');
        }

        // Due date should be within reasonable timeframe
        const maxDays = 30;
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + maxDays);
        
        if (date > maxDate) {
            result.warnings.push('Due date is set more than 30 days in advance');
        }

        // Check against SLA guidelines
        const slaDueDate = this.calculateSLADueDate(urgency, now);
        if (slaDueDate && date > slaDueDate) {
            result.warnings.push(
                `Due date exceeds recommended SLA timeframe for ${urgency} priority`
            );
        }

        if (result.valid) {
            result.sanitizedData.dueDate = date.toISOString();
        }

        return result;
    }
}

/**
 * Export the validator class and utility functions
 */
export {
    TicketValidator
};

export default TicketValidator;