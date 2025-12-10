
export const ROLE_OPTIONS = [
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

export const DEPARTMENTS = [
  // Academic departments (for students)
  { value: 'computer_science', label: 'Computer Science', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
  { value: 'engineering', label: 'Engineering', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
  { value: 'business', label: 'Business School', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
  { value: 'arts_sciences', label: 'Arts & Sciences', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
  { value: 'medicine', label: 'School of Medicine', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
  { value: 'law', label: 'School of Law', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
  { value: 'education', label: 'School of Education', category: 'academic', professionalValue: 'ACADEMIC_AFFAIRS' },
  
  // Administrative departments
  { value: 'administration', label: 'Administration', category: 'administrative', professionalValue: 'ADMINISTRATION' },
  { value: 'it_services', label: 'IT Services', category: 'administrative', professionalValue: 'IT_SERVICES' },
  { value: 'facilities', label: 'Facilities Management', category: 'administrative', professionalValue: 'ADMINISTRATION' },
  { value: 'library', label: 'Library Services', category: 'administrative', professionalValue: 'LIBRARY' },
  { value: 'student_services', label: 'Student Services', category: 'administrative', professionalValue: 'STUDENT_AFFAIRS' },
  { value: 'research', label: 'Research Division', category: 'administrative', professionalValue: 'RESEARCH' },
  { value: 'other', label: 'Other Department', category: 'other', professionalValue: 'ADMINISTRATION' }
];

export const UNIVERSITY_DOMAINS = [
  'bugemauniv.ac.ug',
  'students.bugemauniv.ac.ug',
  'staff.bugemauniv.ac.ug',
  'bugema.ac.ug'
];

export const STUDENT_ID_PATTERNS = [
  /^[0-9]{2}\/[A-Z]{3}\/[A-Z]{2}\/[A-Z]\/[0-9]{4}$/, // Format: 22/BIT/BU/R/0010
  /^[A-Z0-9\/\-_]{6,20}$/, // Alternative format
];

export const CAMPUS_OPTIONS = [
  { value: 'BU', label: 'Main Campus (Luweero)' },
  { value: 'MA', label: 'Kampala Campus' },
  { value: 'KA', label: 'Kasese Campus' },
  { value: 'AR', label: 'Arua Campus' },
  { value: 'MB', label: 'Mbale Campus' },
  { value: 'OTHER', label: 'Other Campus' }
];