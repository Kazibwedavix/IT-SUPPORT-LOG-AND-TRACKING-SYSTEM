import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import '../styles/Auth.css';

/**
 * Enterprise Registration Component for Bugema University IT Support System
 * 
 * This component handles user registration with role-based form fields,
 * comprehensive validation, and security features.
 * 
 * Features:
 * - Role-based registration (student, staff, technician, admin)
 * - Real-time form validation and progress tracking
 * - Password strength analysis with visual feedback
 * - Department mapping based on user role
 * - Email domain validation for university emails
 * - Student ID validation following Bugema University format
 * - Accessibility compliance with ARIA labels
 * - Security event logging
 * - Responsive design
 * 
 * @version 3.1.0
 * @author Bugema University IT Department
 */

const Register = () => {
  // ====================
  // STATE MANAGEMENT
  // ====================
  
  // Form data state
  const [formData, setFormData] = useState({
    // Authentication credentials
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    
    // Personal information
    firstName: '',
    lastName: '',
    phone: '',
    
    // Role and institutional information
    role: 'student',
      department: 'computer_science',
    
    // Student-specific fields
    studentId: '',
    campus: 'BU',
    yearOfEntry: new Date().getFullYear(),
    semester: '1',
    
    // Agreement and preferences
    agreeToTerms: false,
    receiveNotifications: true,
    
    // Professional information
    employeeId: ''
  });

  // UI and validation state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formProgress, setFormProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestedDepartments, setSuggestedDepartments] = useState([]);
  const [isPersonalEmail, setIsPersonalEmail] = useState(false);
  const [fieldTouched, setFieldTouched] = useState({});

  // Refs and hooks
  const firstNameRef = useRef(null);
  const { register, logSecurityEvent, checkUsername } = useAuth();
  const navigate = useNavigate();

  // ====================
  // CONSTANTS AND CONFIGURATION
  // ====================
  
  // Available user roles with descriptions and permissions
  const roleOptions = [
    {
      value: 'student',
      label: 'Student',
      description: 'Access academic resources and submit support tickets',
      icon: '🎓',
      permissions: ['create_ticket', 'view_own_tickets', 'access_knowledge_base'],
      requiresApproval: false,
      requiresStudentId: true
    },
    {
      value: 'staff',
      label: 'Staff/Faculty', 
      description: 'University staff and teaching faculty members',
      icon: '👨‍🏫',
      permissions: ['create_ticket', 'view_department_tickets', 'access_knowledge_base', 'manage_own_assets'],
      requiresApproval: true,
      requiresEmployeeId: false
    },
    {
      value: 'technician',
      label: 'IT Technician',
      description: 'Provide technical support and resolve tickets',
      icon: '👨‍💻',
      permissions: ['view_all_tickets', 'resolve_tickets', 'manage_assets', 'access_admin_tools'],
      requiresApproval: true,
      requiresEmployeeId: true
    },
    {
      value: 'admin',
      label: 'System Administrator',
      description: 'Full system access and user management',
      icon: '👨‍💼',
      permissions: ['all_permissions'],
      requiresApproval: true,
      requiresEmployeeId: true
    }
  ];

  // Department configuration with role-based mapping
  const departments = [
    // Academic departments (for students - lowercase values)
    { value: 'computer_science', label: 'Computer Science', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
    { value: 'engineering', label: 'Engineering', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
    { value: 'business', label: 'Business School', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
    { value: 'arts_sciences', label: 'Arts & Sciences', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
    { value: 'medicine', label: 'School of Medicine', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
    { value: 'law', label: 'School of Law', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
    { value: 'education', label: 'School of Education', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
    
    // Administrative departments (for staff/technicians/admins - uppercase values)
    { value: 'administration', label: 'Administration', category: 'administrative', professionalValue: 'ADMINISTRATION' },
    { value: 'it_services', label: 'IT Services', category: 'administrative', professionalValue: 'IT_SERVICES' },
    { value: 'facilities', label: 'Facilities Management', category: 'administrative', professionalValue: 'ADMINISTRATION' },
    { value: 'library', label: 'Library Services', category: 'administrative', professionalValue: 'LIBRARY' },
    { value: 'student_services', label: 'Student Services', category: 'administrative', professionalValue: 'STUDENT_AFFAIRS' },
    { value: 'research', label: 'Research Division', category: 'administrative', professionalValue: 'RESEARCH' },
    { value: 'other', label: 'Other Department', category: 'other', professionalValue: 'ADMINISTRATION' }
  ];

  // Valid university email domains
  const universityDomains = [
    'bugemauniv.ac.ug',
    'students.bugemauniv.ac.ug',
    'staff.bugemauniv.ac.ug',
    'bugema.ac.ug'
  ];

  // Student ID validation patterns (Bugema University format)
  const studentIdPatterns = [
    /^[0-9]{2}\/[A-Z]{3}\/[A-Z]{2}\/[A-Z]\/[0-9]{4}$/, // Format: 22/BIT/BU/R/0010
    /^[A-Z0-9\/\-_]{6,20}$/, // Alternative format
  ];

  // Campus options for student accounts
  const campusOptions = [
    { value: 'BU', label: 'Main Campus (Luweero)' },
    { value: 'MA', label: 'Kampala Campus' },
    { value: 'KA', label: 'Kasese Campus' },
    { value: 'AR', label: 'Arua Campus' },
    { value: 'MB', label: 'Mbale Campus' },
    { value: 'OTHER', label: 'Other Campus' }
  ];

  // ====================
  // HELPER FUNCTIONS
  // ====================

  /**
   * Maps department value based on user role
   * @param {string} role - User role (student, staff, technician, admin)
   * @param {string} departmentValue - Selected department value
   * @returns {string} Mapped department value
   */
  const getDepartmentValue = (role, departmentValue) => {
    // Students use lowercase academic department values
    if (role === 'student') {
      return departmentValue;
    }
    
    // Staff/technician/admin use uppercase professional department values
    const department = departments.find(dept => dept.value === departmentValue);
    return department ? department.professionalValue : 'ADMINISTRATION';
  };

  /**
   * Gets display label for department based on current role
   * @param {string} role - User role
   * @param {string} departmentValue - Department value
   * @returns {string} Department display label
   */
  const getDepartmentLabel = (role, departmentValue) => {
    const department = departments.find(dept => dept.value === departmentValue);
    return department ? department.label : 'Select Department';
  };

  // ====================
  // ICON PATH CONSTANTS
  // ====================

  const errorPath = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z";
  const checkPath = "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z";
  const xPath = "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z";

  // ====================
  // EFFECT HOOKS
  // ====================

  // Focus first input on component mount
  useEffect(() => {
    if (firstNameRef.current) {
      firstNameRef.current.focus();
    }
  }, []);

  // Calculate form completion progress
  useEffect(() => {
    calculateFormProgress();
  }, [formData]);

  // Calculate password strength when password changes
  useEffect(() => {
    if (formData.password) {
      calculatePasswordStrength(formData.password);
    } else {
      setPasswordStrength(0);
    }
  }, [formData.password]);

  // Filter departments based on selected role
  useEffect(() => {
    if (formData.role === 'student') {
      setSuggestedDepartments(departments.filter(dept => dept.category === 'academic'));
    } else if (['staff', 'technician', 'admin'].includes(formData.role)) {
      setSuggestedDepartments(departments.filter(dept => dept.category === 'administrative' || dept.category === 'other'));
    } else {
      setSuggestedDepartments(departments);
    }
  }, [formData.role]);

  // ====================
  // VALIDATION FUNCTIONS
  // ====================

  /**
   * Validates email format and domain
   * @param {string} email - Email address to validate
   * @returns {string|null} Error message or null if valid
   */
  const validateEmail = (email) => {
    if (!email.trim()) {
      return 'Email address is required';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address';
    }

    // Check if email uses university domain
    const isUniversityEmail = universityDomains.some(domain => 
      email.toLowerCase().endsWith(domain.toLowerCase())
    );

    setIsPersonalEmail(!isUniversityEmail);

    return null;
  };

  /**
   * Validates phone number format (Uganda-specific validation)
   * @param {string} phone - Phone number to validate
   * @returns {string|null} Error message or null if valid
   */
  const validatePhone = (phone) => {
    if (!phone.trim()) return null;
    
    const cleanedPhone = phone.replace(/[\s\-\(\)\.\+\s]/g, '');
    
    // Uganda phone number validation
    if (cleanedPhone.startsWith('256')) {
      if (cleanedPhone.length !== 12) {
        return 'Ugandan phone numbers must be 12 digits with 256 prefix';
      }
      
      const operatorCode = cleanedPhone.substring(3, 6);
      const validOperatorCodes = ['700', '701', '702', '703', '704', '705', '706', '707', '708', '709', 
                                 '710', '711', '712', '713', '714', '715', '716', '717', '718', '719',
                                 '720', '721', '722', '723', '724', '725', '726', '727', '728', '729',
                                 '740', '741', '742', '743', '744', '745', '746', '747', '748', '749',
                                 '750', '751', '752', '753', '754', '755', '756', '757', '758', '759',
                                 '770', '771', '772', '773', '774', '775', '776', '777', '778', '779',
                                 '780', '781', '782', '783', '784', '785', '786', '787', '788', '789',
                                 '790', '791', '792', '793', '794', '795', '796', '797', '798', '799'];
      
      if (!validOperatorCodes.includes(operatorCode)) {
        return 'Please enter a valid Uganda phone number';
      }
    }
    
    // General international phone validation
    const phoneRegex = /^[1-9][0-9]{7,14}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      return 'Please enter a valid phone number';
    }
    
    return null;
  };

  /**
   * Validates username format and checks availability
   * @param {string} username - Username to validate
   * @returns {Promise<string|null>} Error message or null if valid
   */
  const validateUsername = async (username) => {
    if (!username.trim()) {
      return 'Username is required';
    }
    
    if (username.length < 3) {
      return 'Username must be at least 3 characters';
    }
    
    if (username.length > 30) {
      return 'Username cannot exceed 30 characters';
    }
    
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    
    const reservedUsernames = ['admin', 'administrator', 'root', 'system', 'support', 'helpdesk'];
    if (reservedUsernames.includes(username.toLowerCase())) {
      return 'This username is reserved';
    }
    
    // Check username availability via API
    try {
      const result = await checkUsername(username);
      if (!result.available) {
        return 'This username is already taken';
      }
    } catch (error) {
      console.warn('Username availability check failed:', error);
      // Continue registration if availability check fails
    }
    
    return null;
  };

  /**
   * Validates first name format
   * @param {string} firstName - First name to validate
   * @returns {string|null} Error message or null if valid
   */
  const validateFirstName = (firstName) => {
    if (!firstName.trim()) {
      return 'First name is required';
    }
    
    if (firstName.length < 2) {
      return 'First name must be at least 2 characters';
    }
    
    if (firstName.length > 50) {
      return 'First name cannot exceed 50 characters';
    }
    
    const nameRegex = /^[A-Za-z\s\-\'\u00C0-\u024F\u1E00-\u1EFF]+$/;
    if (!nameRegex.test(firstName)) {
      return 'First name can only contain letters, spaces, hyphens, and apostrophes';
    }
    
    return null;
  };

  /**
   * Validates last name format
   * @param {string} lastName - Last name to validate
   * @returns {string|null} Error message or null if valid
   */
  const validateLastName = (lastName) => {
    if (!lastName.trim()) {
      return 'Last name is required';
    }
    
    if (lastName.length < 2) {
      return 'Last name must be at least 2 characters';
    }
    
    if (lastName.length > 50) {
      return 'Last name cannot exceed 50 characters';
    }
    
    const nameRegex = /^[A-Za-z\s\-\'\u00C0-\u024F\u1E00-\u1EFF]+$/;
    if (!nameRegex.test(lastName)) {
      return 'Last name can only contain letters, spaces, hyphens, and apostrophes';
    }
    
    return null;
  };

  /**
   * Validates student ID format for Bugema University
   * @param {string} studentId - Student ID to validate
   * @param {string} role - User role
   * @returns {string|null} Error message or null if valid
   */
  const validateStudentId = (studentId, role) => {
    if (role !== 'student') return null;
    
    if (!studentId || !studentId.trim()) {
      return 'Student ID is required for student accounts';
    }
    
    const formattedId = studentId.trim().toUpperCase();
    
    if (formattedId.length < 10 || formattedId.length > 20) {
      return 'Student ID must be 10-20 characters';
    }
    
    const isValidFormat = studentIdPatterns.some(pattern => pattern.test(formattedId));
    
    if (!isValidFormat) {
      return 'Invalid student ID format. Expected: YY/DEPT/CAMPUS/LEVEL/NUMBER (e.g., 24/BIT/BU/R/0010)';
    }
    
    const year = parseInt(formattedId.substring(0, 2));
    const currentYear = new Date().getFullYear() % 100;
    if (year < 20 || year > currentYear + 5) {
      return 'Invalid year in student ID';
    }
    
    const segments = formattedId.split('/');
    if (segments.length >= 3) {
      const campusCode = segments[2];
      const validCampusCodes = ['BU', 'MA', 'KA', 'AR', 'MB'];
      if (!validCampusCodes.includes(campusCode)) {
        return 'Invalid campus code in student ID';
      }
    }
    
    return null;
  };

  /**
   * Validates password strength requirements
   * @param {string} password - Password to validate
   * @returns {string|null} Error message or null if valid
   */
  const validatePassword = (password) => {
    if (!password) {
      return 'Password is required';
    }
    
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    
    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    
    return null;
  };

  /**
   * Validates password confirmation
   * @param {string} confirmPassword - Confirmed password
   * @param {string} password - Original password
   * @returns {string|null} Error message or null if valid
   */
  const validateConfirmPassword = (confirmPassword, password) => {
    if (!confirmPassword) {
      return 'Please confirm your password';
    }
    
    if (confirmPassword !== password) {
      return 'Passwords do not match';
    }
    
    return null;
  };

  /**
   * Calculates password strength score (0-100)
   * @param {string} password - Password to analyze
   * @returns {number} Strength score
   */
  const calculatePasswordStrength = (password) => {
    let strength = 0;
    
    // Length contributions
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;
    if (password.length >= 16) strength += 10;
    
    // Character variety contributions
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^A-Za-z0-9]/.test(password)) strength += 15;
    
    // Penalties for weak patterns
    if (/(.)\1{2,}/.test(password)) strength -= 10;
    
    const commonPatterns = ['123', 'abc', 'qwe', 'password', 'admin'];
    commonPatterns.forEach(pattern => {
      if (password.toLowerCase().includes(pattern)) strength -= 10;
    });
    
    strength = Math.max(0, Math.min(100, strength));
    setPasswordStrength(strength);
    
    return strength;
  };

  /**
   * Gets password strength information for display
   * @returns {Object} Strength label, color, and CSS class
   */
  const getPasswordStrengthInfo = () => {
    if (passwordStrength < 40) return { label: 'Weak', color: '#ef4444', className: 'weak' };
    if (passwordStrength < 70) return { label: 'Fair', color: '#f59e0b', className: 'fair' };
    if (passwordStrength < 90) return { label: 'Good', color: '#10b981', className: 'good' };
    return { label: 'Strong', color: '#059669', className: 'strong' };
  };

  /**
   * Calculates form completion percentage
   */
  const calculateFormProgress = () => {
    const requiredFields = {
      student: ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'role', 'department', 'studentId', 'agreeToTerms'],
      staff: ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'role', 'department', 'agreeToTerms'],
      technician: ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'role', 'department', 'agreeToTerms'],
      admin: ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'role', 'department', 'agreeToTerms']
    };
    
    const fields = requiredFields[formData.role] || requiredFields.student;
    let completed = 0;
    
    fields.forEach(field => {
      if (field === 'agreeToTerms') {
        if (formData[field]) completed++;
      } else if (field === 'confirmPassword') {
        if (formData.password && formData.confirmPassword && formData.password === formData.confirmPassword) completed++;
      } else if (formData[field]?.toString().trim()) {
        completed++;
      }
    });
    
    const progress = Math.round((completed / fields.length) * 100);
    setFormProgress(progress);
  };

  // ====================
  // FORM HANDLERS
  // ====================

  /**
   * Handles form input changes with validation
   * @param {Object} e - Change event
   */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFieldTouched(prev => ({ ...prev, [name]: true }));
    
    let sanitizedValue = value;
    
    switch (name) {
      case 'username':
        sanitizedValue = value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
        break;
      case 'email':
        sanitizedValue = value.toLowerCase().trim();
        break;
      case 'phone':
        sanitizedValue = formatPhoneNumber(value);
        break;
      case 'studentId':
        sanitizedValue = value.toUpperCase().trim();
        break;
      case 'firstName':
      case 'lastName':
        sanitizedValue = value.trim();
        break;
      case 'yearOfEntry':
        sanitizedValue = value.replace(/\D/g, '').slice(0, 4);
        break;
      default:
        sanitizedValue = value;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : sanitizedValue
    }));
    
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (error) setError('');
  };

  /**
   * Formats phone number for display as user types
   * @param {string} phone - Raw phone number input
   * @returns {string} Formatted phone number
   */
  const formatPhoneNumber = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('256')) {
      if (cleaned.length <= 3) return `+${cleaned}`;
      if (cleaned.length <= 6) return `+${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
      if (cleaned.length <= 9) return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9, 12)}`;
    }
    
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  /**
   * Validates a single form field
   * @param {string} name - Field name
   * @param {string} value - Field value
   * @returns {Promise<string|null>} Error message or null
   */
  const validateField = async (name, value) => {
    switch (name) {
      case 'username':
        return await validateUsername(value);
      case 'email':
        return validateEmail(value);
      case 'password':
        return validatePassword(value);
      case 'confirmPassword':
        return validateConfirmPassword(value, formData.password);
      case 'firstName':
        return validateFirstName(value);
      case 'lastName':
        return validateLastName(value);
      case 'phone':
        return validatePhone(value);
      case 'studentId':
        return validateStudentId(value, formData.role);
      case 'department':
        return !value ? 'Please select your department' : null;
      case 'agreeToTerms':
        return !value ? 'You must agree to the Terms of Service' : null;
      default:
        return null;
    }
  };

  /**
   * Validates the entire form
   * @returns {Promise<boolean>} True if form is valid
   */
  const validateForm = useCallback(async () => {
    const errors = {};
    let hasError = false;
    
    const requiredFields = {
      student: ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'department', 'studentId', 'agreeToTerms'],
      staff: ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'department', 'agreeToTerms'],
      technician: ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'department', 'agreeToTerms'],
      admin: ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 'department', 'agreeToTerms']
    };
    
    const fieldsToValidate = requiredFields[formData.role] || requiredFields.student;
    
    for (const fieldName of fieldsToValidate) {
      const error = await validateField(fieldName, formData[fieldName]);
      if (error) {
        errors[fieldName] = error;
        hasError = true;
      }
    }
    
    if (formData.password && passwordStrength < 40) {
      errors.password = 'Please choose a stronger password';
      hasError = true;
    }
    
    setValidationErrors(errors);
    return !hasError;
  }, [formData, passwordStrength]);

  /**
   * Handles form submission
   * @param {Object} e - Submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setError('');
    
    const allFields = ['username', 'email', 'password', 'confirmPassword', 'firstName', 'lastName', 
                      'department', 'studentId', 'agreeToTerms'];
    const touchedFields = {};
    allFields.forEach(field => touchedFields[field] = true);
    setFieldTouched(touchedFields);
    
    const isValid = await validateForm();
    if (!isValid) {
      setError('Please fix the errors in the form');
      
      logSecurityEvent('registration_validation_failed', {
        email: formData.email,
        role: formData.role,
        errors: Object.keys(validationErrors),
        timestamp: new Date().toISOString()
      });
      
      const firstErrorField = Object.keys(validationErrors)[0];
      if (firstErrorField) {
        const errorElement = document.getElementById(`${firstErrorField}-error`) || 
                            document.querySelector(`[name="${firstErrorField}"]`);
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (errorElement.focus) errorElement.focus();
        }
      }
      
      return;
    }
    
    if (formProgress < 100) {
      setError('Please complete all required fields');
      return;
    }
    
    setLoading(true);
    setIsSubmitting(true);
    
    try {
      logSecurityEvent('registration_attempt', {
        email: formData.email,
        role: formData.role,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
      
      const mappedDepartment = getDepartmentValue(formData.role, formData.department);
      
      // Combine first and last name for fullName field required by backend
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      
      // Prepare registration data for API
      const registrationData = {
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        fullName: fullName, // Required by backend validation
        phone: formData.phone ? formData.phone.replace(/\D/g, '') : undefined,
        department: mappedDepartment, // Root-level department field
        metadata: {
          registrationSource: 'web',
          userAgent: navigator.userAgent,
          screenResolution: `${window.screen.width}x${window.screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };
      
      registrationData.metadata.isPersonalEmail = isPersonalEmail;
      
      // Add role-specific fields
      if (formData.role === 'student') {
        registrationData.studentId = formData.studentId.trim().toUpperCase();
        registrationData.campus = formData.campus;
        registrationData.yearOfEntry = parseInt(formData.yearOfEntry) || new Date().getFullYear();
        registrationData.semester = parseInt(formData.semester) || 1;
        
        // Include academicInfo for backend compatibility
        registrationData.academicInfo = {
          studentId: formData.studentId.trim().toUpperCase(),
          department: formData.department, // Original lowercase for students
          campus: formData.campus,
          yearOfEntry: parseInt(formData.yearOfEntry) || new Date().getFullYear(),
          semester: parseInt(formData.semester) || 1,
          academicStatus: 'active'
        };
      } else {
        if (formData.employeeId) {
          registrationData.employeeId = formData.employeeId.trim().toUpperCase();
        }
        
        // Include professionalInfo for backend compatibility
        registrationData.professionalInfo = {
          department: mappedDepartment // Uppercase for professionals
        };
      }
      
      console.log('📨 Sending registration data:', registrationData);
      
      const result = await register(registrationData);
      
      if (result.success) {
        logSecurityEvent('registration_success', {
          email: formData.email,
          role: formData.role,
          userId: result.data?.user?.id,
          timestamp: new Date().toISOString()
        });
        
        navigate('/login', {
          state: {
            registrationSuccess: true,
            message: 'Account created successfully! Please check your email to verify your account.',
            userRole: formData.role
          }
        });
      } else {
        throw new Error(result.message || 'Registration failed');
      }
      
    } catch (err) {
      console.error('Registration error:', err);
      
      let errorMessage = 'Registration failed. Please try again.';
      
      if (err.response) {
        const { status, data } = err.response;
        
        switch (status) {
          case 400:
            if (data?.code === 'EMAIL_EXISTS') {
              errorMessage = 'An account with this email already exists.';
            } else if (data?.code === 'USERNAME_EXISTS') {
              errorMessage = 'This username is already taken.';
            } else if (data?.code === 'STUDENT_ID_EXISTS') {
              errorMessage = 'This student ID is already registered.';
            } else if (data?.message) {
              errorMessage = data.message;
            } else {
              errorMessage = 'Invalid registration data. Please check your information.';
            }
            break;
          case 409:
            errorMessage = 'An account with this email or username already exists.';
            break;
          case 422:
            errorMessage = data?.message || 'Validation failed. Please check your information.';
            break;
          case 429:
            errorMessage = 'Too many registration attempts. Please try again in 15 minutes.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again later or contact support.';
            break;
          default:
            errorMessage = data?.message || errorMessage;
        }
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your connection and try again.';
      } else if (err.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      } else if (err.message.includes('already exists')) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      logSecurityEvent('registration_failed', {
        email: formData.email,
        error: err.message,
        status: err.response?.status,
        timestamp: new Date().toISOString()
      });
      
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  /**
   * Toggles password visibility
   */
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  /**
   * Toggles confirm password visibility
   */
  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  /**
   * Handles role change and resets role-specific fields
   * @param {string} role - New role value
   */
  const handleRoleChange = (role) => {

     let defaultDepartment = '';
  
  // Set default department based on role
  if (role === 'student') {
    defaultDepartment = 'computer_science'; // Default for students
  } else {
    defaultDepartment = 'administration'; // Default for professionals
  }
    setFormData(prev => ({
      ...prev,
      role,
      
        department: defaultDepartment,
      studentId: role !== 'student' ? '' : prev.studentId,
      employeeId: role !== 'technician' && role !== 'admin' ? '' : prev.employeeId,
      campus: role === 'student' ? prev.campus : 'BU',
      yearOfEntry: role === 'student' ? prev.yearOfEntry : new Date().getFullYear()
    }));
    
    const newErrors = { ...validationErrors };
    delete newErrors.studentId;
    delete newErrors.employeeId;
    delete newErrors.department;
    setValidationErrors(newErrors);
  };

  /**
   * Gets current role configuration object
   * @returns {Object} Role configuration
   */
  const getCurrentRole = () => {
    return roleOptions.find(role => role.value === formData.role) || roleOptions[0];
  };

  // ====================
  // RENDER
  // ====================

  const strengthInfo = getPasswordStrengthInfo();
  const isFormDisabled = loading || isSubmitting;

  return (
    <>
      <Navbar />
      <div className="auth-container">
        <div className="auth-form">
          <div className="auth-header">
            <div className="auth-logo">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 7V12C3 16.97 7.03 21 12 21C16.97 21 21 16.97 21 12V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2>Bugema University IT Support System</h2>
            </div>
            <p className="auth-subtitle">Create your account to access IT support services</p>
          </div>

          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${formProgress}%` }}
              role="progressbar"
              aria-valuenow={formProgress}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <span className="progress-text">{formProgress}% Complete</span>
            </div>
          </div>

          {error && (
            <div className="error-message" role="alert">
              <div className="error-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d={errorPath}/>
                </svg>
              </div>
              <div className="error-content">
                <p>{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="register-form" noValidate>
            <div className="form-section">
              <h3 className="section-title">
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                Personal Information
              </h3>
              
              <div className="form-group">
                <label htmlFor="username" className="form-label">
                  Username <span className="required">*</span>
                </label>
                <div className={`input-group ${validationErrors.username ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={formData.username}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="Choose a username"
                    className="form-input"
                    aria-describedby={validationErrors.username ? "username-error" : undefined}
                    aria-required="true"
                    aria-invalid={!!validationErrors.username}
                  />
                </div>
                {validationErrors.username && (
                  <div id="username-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.username}
                  </div>
                )}
                <div className="info-note info">
                  <p>3-30 characters. Use letters, numbers, underscores, and hyphens only.</p>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address <span className="required">*</span>
                </label>
                <div className={`input-group ${validationErrors.email ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="your.email@bugema.ac.ug"
                    className="form-input"
                    aria-describedby={validationErrors.email ? "email-error" : undefined}
                    aria-required="true"
                    aria-invalid={!!validationErrors.email}
                  />
                </div>
                {validationErrors.email && (
                  <div id="email-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.email}
                  </div>
                )}
                <div className={`info-note ${isPersonalEmail ? 'warning' : 'info'}`}>
                  <div className="note-content">
                    {isPersonalEmail ? (
                      <p>
                        <strong>Note:</strong> Using personal email. For official communication, 
                        use your university email (<strong>@bugemauniv.ac.ug</strong>).
                      </p>
                    ) : (
                      <p>✅ Verified Bugema University email address</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="firstName" className="form-label">
                  First Name <span className="required">*</span>
                </label>
                <div className={`input-group ${validationErrors.firstName ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                  <input
                    ref={firstNameRef}
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="Enter your first name"
                    className="form-input"
                    aria-describedby={validationErrors.firstName ? "firstName-error" : undefined}
                    aria-required="true"
                    aria-invalid={!!validationErrors.firstName}
                  />
                </div>
                {validationErrors.firstName && (
                  <div id="firstName-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.firstName}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="lastName" className="form-label">
                  Last Name <span className="required">*</span>
                </label>
                <div className={`input-group ${validationErrors.lastName ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                  </div>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="Enter your last name"
                    className="form-input"
                    aria-describedby={validationErrors.lastName ? "lastName-error" : undefined}
                    aria-required="true"
                    aria-invalid={!!validationErrors.lastName}
                  />
                </div>
                {validationErrors.lastName && (
                  <div id="lastName-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.lastName}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  Phone Number
                </label>
                <div className={`input-group ${validationErrors.phone ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                    </svg>
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="+256 XXX XXX XXX"
                    className="form-input"
                    aria-describedby={validationErrors.phone ? "phone-error" : undefined}
                    aria-invalid={!!validationErrors.phone}
                  />
                </div>
                {validationErrors.phone && (
                  <div id="phone-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.phone}
                  </div>
                )}
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                Account Type
              </h3>
              
              <div className="role-selection">
                {roleOptions.map(option => (
                  <label 
                    key={option.value} 
                    className={`role-option ${formData.role === option.value ? 'selected' : ''}`}
                    onClick={() => handleRoleChange(option.value)}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={option.value}
                      checked={formData.role === option.value}
                      onChange={() => handleRoleChange(option.value)}
                      className="role-radio"
                      disabled={isFormDisabled}
                      aria-label={option.label}
                    />
                    <div className="role-content">
                      <span className="role-icon">{option.icon}</span>
                      <div className="role-info">
                        <span className="role-label">{option.label}</span>
                        <span className="role-description">{option.description}</span>
                        {option.requiresApproval && (
                          <span className="role-notice">
                            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '14px', height: '14px', marginRight: '4px' }}>
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                            Requires approval
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="role-permissions">
                <h4>Permissions for {getCurrentRole().label}:</h4>
                <ul>
                  {getCurrentRole().permissions.slice(0, 5).map((permission, index) => (
                    <li key={index}>
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '16px', height: '16px', marginRight: '8px' }}>
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                      {permission.replace(/_/g, ' ')}
                    </li>
                  ))}
                  {getCurrentRole().permissions.length > 5 && (
                    <li>...and {getCurrentRole().permissions.length - 5} more permissions</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4-3h2v13h-2z"/>
                </svg>
                Department & Additional Information
              </h3>
              
              <div className="form-group">
                <label htmlFor="department" className="form-label">
                  Department <span className="required">*</span>
                </label>
                <div className={`input-group ${validationErrors.department ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/>
                    </svg>
                  </div>
                  <select
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    className="form-select"
                    aria-describedby={validationErrors.department ? "department-error" : undefined}
                    aria-required="true"
                    aria-invalid={!!validationErrors.department}
                  >
                    <option value="">Select your department</option>
                    {suggestedDepartments.map(dept => (
                      <option key={dept.value} value={dept.value}>
                        {dept.label}
                      </option>
                    ))}
                  </select>
                </div>
                {validationErrors.department && (
                  <div id="department-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.department}
                  </div>
                )}
                <div className="info-note info">
                  <p>
                    {formData.role === 'student' 
                      ? 'Academic departments are shown for student accounts.' 
                      : 'Administrative departments are shown for staff/technician/admin accounts.'}
                  </p>
                </div>
              </div>

              {formData.role === 'student' && (
                <>
                  <div className="form-group">
                    <label htmlFor="studentId" className="form-label">
                      Student ID <span className="required">*</span>
                    </label>
                    <div className={`input-group ${validationErrors.studentId ? 'error' : ''}`}>
                      <div className="input-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/>
                        </svg>
                      </div>
                      <input
                        id="studentId"
                        name="studentId"
                        type="text"
                        value={formData.studentId}
                        onChange={handleChange}
                        disabled={isFormDisabled}
                        placeholder="Format: 24/BIT/BU/R/0010"
                        className="form-input"
                        aria-describedby={validationErrors.studentId ? "studentId-error" : undefined}
                        aria-required={formData.role === 'student'}
                        aria-invalid={!!validationErrors.studentId}
                      />
                    </div>
                    {validationErrors.studentId && (
                      <div id="studentId-error" className="error-text" role="alert">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        {validationErrors.studentId}
                      </div>
                    )}
                    <div className="info-note info">
                      <div className="note-content">
                        <p><strong>Format:</strong> Year/Department/Campus/Level/Number (e.g., 22/BIT/BU/R/0010)</p>
                        <p><strong>Campus codes:</strong> BU (Main), MA (Kampala), KA (Kasese), AR (Arua), MB (Mbale)</p>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="campus" className="form-label">
                      Campus
                    </label>
                    <select
                      id="campus"
                      name="campus"
                      value={formData.campus}
                      onChange={handleChange}
                      disabled={isFormDisabled}
                      className="form-select"
                    >
                      {campusOptions.map(campus => (
                        <option key={campus.value} value={campus.value}>
                          {campus.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="yearOfEntry" className="form-label">
                      Year of Entry
                    </label>
                    <input
                      id="yearOfEntry"
                      name="yearOfEntry"
                      type="number"
                      min="2000"
                      max={new Date().getFullYear() + 1}
                      value={formData.yearOfEntry}
                      onChange={handleChange}
                      disabled={isFormDisabled}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="semester" className="form-label">
                      Semester
                    </label>
                    <select
                      id="semester"
                      name="semester"
                      value={formData.semester}
                      onChange={handleChange}
                      disabled={isFormDisabled}
                      className="form-select"
                    >
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                      <option value="3">Semester 3</option>
                    </select>
                  </div>
                </>
              )}

              {['technician', 'admin'].includes(formData.role) && (
                <div className="form-group">
                  <label htmlFor="employeeId" className="form-label">
                    Employee ID (Optional)
                  </label>
                  <input
                    id="employeeId"
                    name="employeeId"
                    type="text"
                    value={formData.employeeId}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="e.g., IT2024001"
                    className="form-input"
                  />
                  <div className="info-note info">
                    <p>Provide your employee ID for verification purposes.</p>
                  </div>
                </div>
              )}

              {(formData.role === 'technician' || formData.role === 'admin' || formData.role === 'staff') && (
                <div className="info-note warning">
                  <div className="note-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                  </div>
                  <div className="note-content">
                    <strong>Account Verification Required</strong>
                    <p>Staff, technician, and administrator accounts require verification by system administrators. You will receive an email notification once your account is approved.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                </svg>
                Security Settings
              </h3>
              
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Password <span className="required">*</span>
                </label>
                <div className={`input-group ${validationErrors.password ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="Create a strong password"
                    className="form-input"
                    aria-describedby={validationErrors.password ? "password-error" : undefined}
                    aria-required="true"
                    aria-invalid={!!validationErrors.password}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="password-toggle"
                    disabled={isFormDisabled}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-controls="password"
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                      </svg>
                    )}
                  </button>
                </div>
                
                {formData.password && (
                  <div className="password-strength">
                    <div className="strength-meter">
                      <div 
                        className={`strength-bar ${strengthInfo.className}`}
                        style={{ width: `${passwordStrength}%`, backgroundColor: strengthInfo.color }}
                      ></div>
                    </div>
                    <div className="strength-info">
                      <span className="strength-label">Strength: {strengthInfo.label}</span>
                      <span className="strength-score">{passwordStrength}%</span>
                    </div>
                  </div>
                )}
                
                {validationErrors.password && (
                  <div id="password-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.password}
                  </div>
                )}
                
                <div className="password-requirements">
                  <p><strong>Password must contain:</strong></p>
                  <ul>
                    <li className={formData.password.length >= 8 ? 'valid' : 'invalid'}>
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '14px', height: '14px', marginRight: '4px' }}>
                        {formData.password.length >= 8 ? (
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        ) : (
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        )}
                      </svg>
                      At least 8 characters
                    </li>
                    <li className={/[A-Z]/.test(formData.password) ? 'valid' : 'invalid'}>
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '14px', height: '14px', marginRight: '4px' }}>
                        {/[A-Z]/.test(formData.password) ? (
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        ) : (
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        )}
                      </svg>
                      One uppercase letter
                    </li>
                    <li className={/[a-z]/.test(formData.password) ? 'valid' : 'invalid'}>
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '14px', height: '14px', marginRight: '4px' }}>
                        {/[a-z]/.test(formData.password) ? (
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        ) : (
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        )}
                      </svg>
                      One lowercase letter
                    </li>
                    <li className={/[0-9]/.test(formData.password) ? 'valid' : 'invalid'}>
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '14px', height: '14px', marginRight: '4px' }}>
                        {/[0-9]/.test(formData.password) ? (
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        ) : (
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        )}
                      </svg>
                      One number
                    </li>
                    <li className={/[^A-Za-z0-9]/.test(formData.password) ? 'valid' : 'invalid'}>
                      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '14px', height: '14px', marginRight: '4px' }}>
                        {/[^A-Za-z0-9]/.test(formData.password) ? (
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        ) : (
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        )}
                      </svg>
                      One special character
                    </li>
                  </ul>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password <span className="required">*</span>
                </label>
                <div className={`input-group ${validationErrors.confirmPassword ? 'error' : ''}`}>
                  <div className="input-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    placeholder="Re-enter your password"
                    className="form-input"
                    aria-describedby={validationErrors.confirmPassword ? "confirmPassword-error" : undefined}
                    aria-required="true"
                    aria-invalid={!!validationErrors.confirmPassword}
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="password-toggle"
                    disabled={isFormDisabled}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    aria-controls="confirmPassword"
                  >
                    {showConfirmPassword ? (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                      </svg>
                    )}
                  </button>
                </div>
                {validationErrors.confirmPassword && (
                  <div id="confirmPassword-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.confirmPassword}
                  </div>
                )}
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px' }}>
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"/>
                </svg>
                Terms and Conditions
              </h3>
              
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    className="checkbox-input"
                    aria-describedby={validationErrors.agreeToTerms ? "terms-error" : undefined}
                    aria-required="true"
                    aria-invalid={!!validationErrors.agreeToTerms}
                  />
                  <span className="checkbox-custom"></span>
                  <span className="checkbox-text">
                    I agree to the{' '}
                    <Link to="/terms" target="_blank" className="link">
                      Terms of Service
                    </Link>
                    {' '}and{' '}
                    <Link to="/privacy" target="_blank" className="link">
                      Privacy Policy
                    </Link>
                    <span className="required">*</span>
                  </span>
                </label>
                {validationErrors.agreeToTerms && (
                  <div id="terms-error" className="error-text" role="alert">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {validationErrors.agreeToTerms}
                  </div>
                )}
              </div>
              
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="receiveNotifications"
                    checked={formData.receiveNotifications}
                    onChange={handleChange}
                    disabled={isFormDisabled}
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom"></span>
                  <span className="checkbox-text">
                    I want to receive notifications about system updates, security alerts, and important announcements
                  </span>
                </label>
              </div>
              
              <div className="info-note">
                <div className="note-content">
                  <p><strong>Important Information:</strong></p>
                  <ul>
                    <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                    <li>You must provide accurate and truthful information during registration</li>
                    <li>All accounts are subject to verification and approval by system administrators</li>
                    <li>Student accounts require valid Bugema University student ID</li>
                    <li>Staff/Technician/Admin accounts require administrative approval</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="form-actions">
              <button
                type="submit"
                disabled={isFormDisabled || formProgress < 100}
                className={`auth-btn ${loading ? 'loading' : ''}`}
                aria-busy={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
              
              <div className="progress-note">
                <p>
                  {formProgress < 100 ? (
                    `Complete all required fields (${formProgress}%) to enable registration`
                  ) : (
                    '✓ All required fields completed. Ready to register.'
                  )}
                </p>
              </div>
            </div>
          </form>
          
          <div className="auth-footer">
            <p className="auth-link">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="link"
                aria-disabled={isFormDisabled}
              >
                Login here
              </Link>
            </p>
            <p className="auth-version">
              IT Support System v{process.env.REACT_APP_VERSION || '3.1.0'} • Bugema University
            </p>
          </div>

          <div className="security-footer">
            <p className="security-notice">
              <strong>Security Notice:</strong> Your information is protected with enterprise-grade security measures.
            </p>
            <p className="security-contact">
              For registration assistance, contact IT Support: 📧{' '}
              <a href="mailto:support@bugemauniv.ac.ug">support@bugemauniv.ac.ug</a> • 📞{' '}
              <a href="tel:+256784845785">+256 784-845-785</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;