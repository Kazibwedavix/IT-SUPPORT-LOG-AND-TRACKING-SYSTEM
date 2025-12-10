// frontend/src/utils/validationHelpers.js
import { debounce } from 'lodash';

export const validateEmail = (email, universityDomains = []) => {
  if (!email?.trim()) {
    return 'Email address is required';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Please enter a valid email address';
  }

  return null;
};

export const validatePhone = (phone) => {
  if (!phone?.trim()) return null;
  
  const cleanedPhone = phone.replace(/[\s\-\(\)\.\+\s]/g, '');
  
  // Uganda phone validation
  if (cleanedPhone.startsWith('256')) {
    if (cleanedPhone.length !== 12) {
      return 'Ugandan phone numbers must be 12 digits with 256 prefix';
    }
    
    const operatorCode = cleanedPhone.substring(3, 6);
    const validOperatorCodes = [
      '700', '701', '702', '703', '704', '705', '706', '707', '708', '709',
      '710', '711', '712', '713', '714', '715', '716', '717', '718', '719',
      '720', '721', '722', '723', '724', '725', '726', '727', '728', '729',
      '740', '741', '742', '743', '744', '745', '746', '747', '748', '749',
      '750', '751', '752', '753', '754', '755', '756', '757', '758', '759',
      '770', '771', '772', '773', '774', '775', '776', '777', '778', '779',
      '780', '781', '782', '783', '784', '785', '786', '787', '788', '789',
      '790', '791', '792', '793', '794', '795', '796', '797', '798', '799'
    ];
    
    if (!validOperatorCodes.includes(operatorCode)) {
      return 'Please enter a valid Uganda phone number';
    }
  }
  
  const phoneRegex = /^[1-9][0-9]{7,14}$/;
  if (!phoneRegex.test(cleanedPhone)) {
    return 'Please enter a valid phone number';
  }
  
  return null;
};

export const validateUsername = async (username, checkUsernameApi) => {
  if (!username?.trim()) {
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
  
  // Debounced API check
  try {
    const result = await checkUsernameApi(username);
    if (!result.available) {
      return 'This username is already taken';
    }
  } catch (error) {
    console.warn('Username availability check failed:', error);
    // Don't block registration if check fails
  }
  
  return null;
};

export const validateFirstName = (firstName) => {
  if (!firstName?.trim()) {
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

export const validateLastName = (lastName) => {
  if (!lastName?.trim()) {
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

export const validateStudentId = (studentId, role, patterns) => {
  if (role !== 'student') return null;
  
  if (!studentId || !studentId.trim()) {
    return 'Student ID is required for student accounts';
  }
  
  const formattedId = studentId.trim().toUpperCase();
  
  if (formattedId.length < 10 || formattedId.length > 20) {
    return 'Student ID must be 10-20 characters';
  }
  
  const isValidFormat = patterns.some(pattern => pattern.test(formattedId));
  
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

export const validatePassword = (password) => {
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

export const validateConfirmPassword = (confirmPassword, password) => {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  
  if (confirmPassword !== password) {
    return 'Passwords do not match';
  }
  
  return null;
};

export const calculatePasswordStrength = (password) => {
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
  
  return Math.max(0, Math.min(100, strength));
};

export const formatPhoneNumber = (phone) => {
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

export const sanitizeFormData = (formData, isPersonalEmail) => {
  const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
  
  const registrationData = {
    username: formData.username.trim(),
    email: formData.email.trim().toLowerCase(),
    password: formData.password,
    role: formData.role,
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    fullName: fullName,
    phone: formData.phone ? formData.phone.replace(/\D/g, '') : undefined,
    metadata: {
      registrationSource: 'web',
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isPersonalEmail: isPersonalEmail
    }
  };
  
  // Add role-specific fields
  if (formData.role === 'student') {
    registrationData.studentId = formData.studentId.trim().toUpperCase();
    registrationData.campus = formData.campus;
    registrationData.yearOfEntry = parseInt(formData.yearOfEntry) || new Date().getFullYear();
    registrationData.semester = parseInt(formData.semester) || 1;
    
    registrationData.academicInfo = {
      studentId: formData.studentId.trim().toUpperCase(),
      department: formData.department,
      campus: formData.campus,
      yearOfEntry: parseInt(formData.yearOfEntry) || new Date().getFullYear(),
      semester: parseInt(formData.semester) || 1,
      academicStatus: 'active'
    };
  } else {
    if (formData.employeeId) {
      registrationData.employeeId = formData.employeeId.trim().toUpperCase();
    }
    
    registrationData.professionalInfo = {
      department: formData.department.toUpperCase(),
      employmentType: 'FULL_TIME'
    };
  }
  
  return registrationData;
};