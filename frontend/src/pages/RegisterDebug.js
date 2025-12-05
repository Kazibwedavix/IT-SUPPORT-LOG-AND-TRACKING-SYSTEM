import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const RegisterDebug = () => {
  const navigate = useNavigate();
  const { register, error: authError, clearError } = useContext(AuthContext);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    firstName: '',
    lastName: '',
    studentId: '',
    department: '',
    phone: '',
    campus: 'BU',
    yearOfEntry: new Date().getFullYear(),
    semester: '1',
    agreeTerms: false
  });

  const [errors, setErrors] = useState({});
  const [validationRules, setValidationRules] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debugInfo, setDebugInfo] = useState({
    validationChecks: [],
    formDataHistory: []
  });

  // Load validation rules from localStorage or use defaults
  useEffect(() => {
    const savedRules = localStorage.getItem('debugValidationRules');
    if (savedRules) {
      setValidationRules(JSON.parse(savedRules));
    } else {
      // Default validation rules
      const defaultRules = {
        username: {
          required: true,
          minLength: 3,
          maxLength: 50,
          pattern: /^[a-zA-Z0-9_]+$/,
          message: 'Username can only contain letters, numbers, and underscores'
        },
        email: {
          required: true,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
          message: 'Please enter a valid email address'
        },
        password: {
          required: true,
          minLength: 8,
          pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
          message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        },
        confirmPassword: {
          required: true,
          match: 'password',
          message: 'Passwords do not match'
        },
        role: {
          required: true,
          allowedValues: ['student', 'staff', 'technician', 'admin']
        },
        studentId: {
          requiredWhen: { role: 'student' },
          pattern: /^[0-9]{2}\/[A-Z]{3,5}\/[A-Z]{2}\/[A-Z]\/[0-9]{3,5}$/,
          message: 'Student ID must follow format: YY/DEPT/CAMPUS/LEVEL/NUMBER (e.g., 22/BIT/BU/R/0010)'
        },
        department: {
          required: true,
          allowedValues: [
            'computer_science', 'engineering', 'business', 'arts_sciences',
            'medicine', 'law', 'education', 'it_services', 'administration',
            'facilities', 'library', 'student_services', 'research', 'other'
          ]
        },
        agreeTerms: {
          required: true,
          mustBeTrue: true,
          message: 'You must agree to the terms and conditions'
        }
      };
      setValidationRules(defaultRules);
      localStorage.setItem('debugValidationRules', JSON.stringify(defaultRules));
    }
  }, []);

  const validateField = (fieldName, value) => {
    const rule = validationRules[fieldName];
    if (!rule) return null;

    const checks = [];

    // Required check
    if (rule.required) {
      if (!value || value.toString().trim() === '') {
        checks.push({
          check: 'required',
          passed: false,
          message: `${fieldName} is required`
        });
        return checks;
      } else {
        checks.push({
          check: 'required',
          passed: true
        });
      }
    }

    // Required when condition
    if (rule.requiredWhen) {
      const conditionField = Object.keys(rule.requiredWhen)[0];
      const conditionValue = rule.requiredWhen[conditionField];
      if (formData[conditionField] === conditionValue) {
        if (!value || value.toString().trim() === '') {
          checks.push({
            check: 'requiredWhen',
            passed: false,
            message: `${fieldName} is required when ${conditionField} is ${conditionValue}`
          });
          return checks;
        }
      }
      checks.push({
        check: 'requiredWhen',
        passed: true
      });
    }

    // Min length check
    if (rule.minLength && value && value.length < rule.minLength) {
      checks.push({
        check: 'minLength',
        passed: false,
        message: `${fieldName} must be at least ${rule.minLength} characters`
      });
    } else if (rule.minLength) {
      checks.push({
        check: 'minLength',
        passed: true
      });
    }

    // Max length check
    if (rule.maxLength && value && value.length > rule.maxLength) {
      checks.push({
        check: 'maxLength',
        passed: false,
        message: `${fieldName} cannot exceed ${rule.maxLength} characters`
      });
    } else if (rule.maxLength) {
      checks.push({
        check: 'maxLength',
        passed: true
      });
    }

    // Pattern check
    if (rule.pattern && value && !rule.pattern.test(value)) {
      checks.push({
        check: 'pattern',
        passed: false,
        message: rule.message || `${fieldName} format is invalid`
      });
    } else if (rule.pattern) {
      checks.push({
        check: 'pattern',
        passed: true
      });
    }

    // Match check (for confirmPassword)
    if (rule.match && value !== formData[rule.match]) {
      checks.push({
        check: 'match',
        passed: false,
        message: rule.message || `${fieldName} does not match ${rule.match}`
      });
    } else if (rule.match) {
      checks.push({
        check: 'match',
        passed: true
      });
    }

    // Must be true check (for checkboxes)
    if (rule.mustBeTrue && !value) {
      checks.push({
        check: 'mustBeTrue',
        passed: false,
        message: rule.message
      });
    } else if (rule.mustBeTrue) {
      checks.push({
        check: 'mustBeTrue',
        passed: true
      });
    }

    // Allowed values check
    if (rule.allowedValues && value && !rule.allowedValues.includes(value)) {
      checks.push({
        check: 'allowedValues',
        passed: false,
        message: `${fieldName} must be one of: ${rule.allowedValues.join(', ')}`
      });
    } else if (rule.allowedValues) {
      checks.push({
        check: 'allowedValues',
        passed: true
      });
    }

    return checks;
  };

  const validateForm = () => {
    const newErrors = {};
    const validationChecks = [];

    Object.keys(formData).forEach(fieldName => {
      const value = formData[fieldName];
      const checks = validateField(fieldName, value);

      if (checks) {
        validationChecks.push({
          field: fieldName,
          value: value,
          checks: checks
        });

        const failedChecks = checks.filter(check => !check.passed);
        if (failedChecks.length > 0) {
          newErrors[fieldName] = failedChecks[0].message;
        }
      }
    });

    setDebugInfo(prev => ({
      ...prev,
      validationChecks,
      formDataHistory: [...prev.formDataHistory.slice(-9), {
        timestamp: new Date().toISOString(),
        data: { ...formData }
      }]
    }));

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🟡 SUBMIT BUTTON CLICKED');
    
    clearError();
    
    // Validate form
    console.log('🟡 Validating form...');
    const isValid = validateForm();
    
    if (!isValid) {
      console.log('🔴 Form validation failed');
      console.log('🔴 Errors:', errors);
      console.log('🔴 Form data:', formData);
      return;
    }

    console.log('🟢 Form validation passed');
    console.log('🟢 Sending registration request...');
    
    setIsSubmitting(true);

    try {
      // Prepare registration data
      const registrationData = {
        username: formData.username.trim(),
        email: formData.email.toLowerCase().trim(),
        password: formData.password,
        role: formData.role,
        firstName: formData.firstName?.trim(),
        lastName: formData.lastName?.trim(),
        studentId: formData.studentId?.toUpperCase().trim(),
        department: formData.department,
        phone: formData.phone,
        campus: formData.campus,
        yearOfEntry: parseInt(formData.yearOfEntry),
        semester: parseInt(formData.semester)
      };

      console.log('📤 Registration data being sent:', registrationData);
      
      const result = await register(registrationData);
      console.log('✅ Registration successful:', result);
      
      // Redirect to login or dashboard
      navigate('/login', { 
        state: { message: 'Registration successful! Please check your email to verify your account.' } 
      });
      
    } catch (error) {
      console.error('🔴 Registration error:', error);
      console.error('🔴 Error message:', error.message);
      
      // Don't set error state here - AuthContext should handle it
    } finally {
      setIsSubmitting(false);
    }
  };

  const testValidation = () => {
    console.log('🧪 Running validation test...');
    validateForm();
  };

  const loadTestData = (type) => {
    const testData = {
      validStudent: {
        username: `student_${Date.now()}`,
        email: `test.student${Date.now()}@bugema.ac.ug`,
        password: 'Test123!@#',
        confirmPassword: 'Test123!@#',
        role: 'student',
        firstName: 'Test',
        lastName: 'Student',
        studentId: '24/BIT/BU/R/0010',
        department: 'computer_science',
        phone: '256700000000',
        campus: 'BU',
        yearOfEntry: '2024',
        semester: '1',
        agreeTerms: true
      },
      validStaff: {
        username: `staff_${Date.now()}`,
        email: `staff${Date.now()}@bugema.ac.ug`,
        password: 'Staff123!@#',
        confirmPassword: 'Staff123!@#',
        role: 'staff',
        firstName: 'Test',
        lastName: 'Staff',
        department: 'administration',
        phone: '256711111111',
        agreeTerms: true
      },
      invalid: {
        username: 'ab', // Too short
        email: 'invalid-email',
        password: 'weak',
        confirmPassword: 'different',
        role: '',
        agreeTerms: false
      }
    };

    setFormData(prev => ({
      ...prev,
      ...testData[type]
    }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Registration Debug Tool</h1>
      <p className="text-gray-600 mb-6">This tool helps identify form validation issues</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Debug Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Debug Controls</h2>
            
            <div className="space-y-3">
              <button
                onClick={() => loadTestData('validStudent')}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Load Valid Student Data
              </button>
              
              <button
                onClick={() => loadTestData('validStaff')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Load Valid Staff Data
              </button>
              
              <button
                onClick={() => loadTestData('invalid')}
                className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Load Invalid Data
              </button>
              
              <button
                onClick={testValidation}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Test Validation Only
              </button>
              
              <button
                onClick={() => {
                  setErrors({});
                  console.clear();
                  console.log('🧹 Form cleared');
                }}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Clear Errors & Console
              </button>
            </div>
          </div>
          
          {/* Debug Info Panel */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Debug Information</h2>
            
            <div className="space-y-2">
              <div>
                <span className="font-semibold">Validation Status:</span>
                <span className={`ml-2 ${Object.keys(errors).length === 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Object.keys(errors).length === 0 ? '✅ Valid' : '❌ Invalid'}
                </span>
                <span className="ml-2">({Object.keys(errors).length} errors)</span>
              </div>
              
              <div>
                <span className="font-semibold">Submitting:</span>
                <span className={`ml-2 ${isSubmitting ? 'text-yellow-600' : 'text-gray-600'}`}>
                  {isSubmitting ? '⏳ Processing...' : 'Ready'}
                </span>
              </div>
              
              {authError && (
                <div className="p-2 bg-red-100 rounded">
                  <span className="font-semibold">Auth Error:</span>
                  <span className="ml-2 text-red-600">{authError}</span>
                </div>
              )}
              
              <div className="mt-4">
                <h3 className="font-bold mb-2">Recent Form Data:</h3>
                <pre className="text-xs bg-gray-800 text-white p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(debugInfo.formDataHistory, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
        
        {/* Middle Column: Registration Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6">Registration Form</h2>
            
            {/* Username */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Username *</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter username"
              />
              {errors.username && (
                <p className="text-red-500 text-sm mt-1">{errors.username}</p>
              )}
            </div>
            
            {/* Email */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter email"
              />
              {errors.email && (
                <p className="text-red-500 text-sm mt-1">{errors.email}</p>
              )}
            </div>
            
            {/* Password */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Password *</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter password"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password}</p>
              )}
            </div>
            
            {/* Confirm Password */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded ${errors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Confirm password"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>
            
            {/* Role */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Role *</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded ${errors.role ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="technician">Technician</option>
                <option value="admin">Admin</option>
              </select>
              {errors.role && (
                <p className="text-red-500 text-sm mt-1">{errors.role}</p>
              )}
            </div>
            
            {/* Student ID (only for students) */}
            {formData.role === 'student' && (
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">Student ID *</label>
                <input
                  type="text"
                  name="studentId"
                  value={formData.studentId}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded ${errors.studentId ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Format: 24/BIT/BU/R/0010"
                />
                {errors.studentId && (
                  <p className="text-red-500 text-sm mt-1">{errors.studentId}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Format: YY/DEPT/CAMPUS/LEVEL/NUMBER (e.g., 24/BIT/BU/R/0010)
                </p>
              </div>
            )}
            
            {/* Department */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Department *</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded ${errors.department ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">Select Department</option>
                <option value="computer_science">Computer Science</option>
                <option value="engineering">Engineering</option>
                <option value="business">Business</option>
                <option value="arts_sciences">Arts & Sciences</option>
                <option value="medicine">Medicine</option>
                <option value="law">Law</option>
                <option value="education">Education</option>
                <option value="it_services">IT Services</option>
                <option value="administration">Administration</option>
                <option value="facilities">Facilities</option>
                <option value="library">Library</option>
                <option value="student_services">Student Services</option>
                <option value="research">Research</option>
                <option value="other">Other</option>
              </select>
              {errors.department && (
                <p className="text-red-500 text-sm mt-1">{errors.department}</p>
              )}
            </div>
            
            {/* First Name */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Enter first name"
              />
            </div>
            
            {/* Last Name */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Enter last name"
              />
            </div>
            
            {/* Phone */}
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="256700000000"
              />
            </div>
            
            {/* Terms Agreement */}
            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="agreeTerms"
                  checked={formData.agreeTerms}
                  onChange={handleChange}
                  className="mr-2"
                />
                <span className="text-gray-700">
                  I agree to the Terms and Conditions *
                </span>
              </label>
              {errors.agreeTerms && (
                <p className="text-red-500 text-sm mt-1">{errors.agreeTerms}</p>
              )}
            </div>
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full px-4 py-2 rounded text-white font-bold ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isSubmitting ? 'Registering...' : 'Register'}
            </button>
            
            <div className="mt-4 text-center">
              <Link to="/login" className="text-blue-600 hover:underline">
                Already have an account? Login
              </Link>
            </div>
          </form>
        </div>
      </div>
      
      {/* Validation Details Panel */}
      <div className="mt-8 bg-gray-50 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Validation Details</h2>
        <div className="space-y-4">
          {debugInfo.validationChecks.map((fieldCheck, index) => (
            <div key={index} className="border rounded p-3">
              <div className="font-bold mb-2">
                {fieldCheck.field}: <span className="font-mono">"{fieldCheck.value}"</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {fieldCheck.checks.map((check, checkIndex) => (
                  <div 
                    key={checkIndex} 
                    className={`text-sm p-1 rounded ${check.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                  >
                    {check.check}: {check.passed ? '✅' : '❌'} 
                    {check.message && ` - ${check.message}`}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RegisterDebug;