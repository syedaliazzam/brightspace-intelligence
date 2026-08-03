export const dashboardNavigation = {
  superadmin: [
    { label: "Dashboard", href: "/superadmin/dashboard" },
    { label: "All Events Calendar", href: "/superadmin/class-schedulers" },
    { label: "Event Registrations", href: "/superadmin/public-event-registrations" },
    { label: "Interested Students", href: "/superadmin/interested-students" },
    { label: "Parent Interview Forms", href: "/superadmin/parent-interview-forms" },
    { label: "Admission Records", href: "/superadmin/registration-leads" },
    { label: "Need Based Scholarship", href: "/superadmin/need-based-scholarships" },
    { label: "Fee Management", href: "/superadmin/fee-settings" },
    { label: "Payments", href: "/superadmin/payments" },
    { label: "Careers Applications", href: "/superadmin/careers-applications" },
    {
      label: "User Management",
      children: [
        { label: "Staff Management", href: "/superadmin/users?view=staff" },
        { label: "Students Management", href: "/superadmin/users?view=students" },
        { label: "Parents Management", href: "/superadmin/users?view=parents" },
      ],
    },
    { label: "Subject Catalog", href: "/superadmin/subjects" },
    { label: "Class Management", href: "/superadmin/courses" },
    { label: "Notes", href: "/superadmin/notes" },
    { label: "Headlines", href: "/superadmin/headlines" },
    { label: "Audit History", href: "/superadmin/audit-logs" },
    { label: "Sent Emails", href: "/superadmin/sent-emails" },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "All Events Calendar", href: "/admin/class-schedulers" },
    { label: "Event Registrations", href: "/admin/public-event-registrations" },
    { label: "Interested Students", href: "/admin/interested-students" },
    { label: "Parent Interview Forms", href: "/admin/parent-interview-forms" },
    { label: "Admission Records", href: "/admin/registration-leads" },
    { label: "Need Based Scholarship", href: "/admin/need-based-scholarships" },
    { label: "Payments", href: "/admin/payments" },
    { label: "Careers Applications", href: "/admin/careers-applications" },
    {
      label: "User Management",
      children: [
        { label: "Staff Management", href: "/admin/users?view=staff" },
        { label: "Students Management", href: "/admin/users?view=students" },
        { label: "Parents Management", href: "/admin/users?view=parents" },
      ],
    },
    { label: "Subject Catalog", href: "/admin/subjects" },
    { label: "Class Management", href: "/admin/courses" },
    { label: "Notes", href: "/admin/notes" },
    { label: "Headlines", href: "/admin/headlines" },
    { label: "Audit History", href: "/admin/audit-logs" },    
    { label: "Sent Emails", href: "/admin/sent-emails" },
  ],
  coordinator: [
    { label: "Dashboard", href: "/coordinator/dashboard" },
    { label: "All Events Calendar", href: "/coordinator/class-schedulers" },
    { label: "Public Events", href: "/coordinator/public-events" },
    { label: "Internal Events", href: "/coordinator/internal-events" },
    { label: "Event Registrations", href: "/coordinator/public-event-registrations" },
    { label: "Interested Students", href: "/coordinator/interested-students" },
    { label: "Parent Interview Forms", href: "/coordinator/parent-interview-forms" },
    { label: "Admission Records", href: "/coordinator/registration-leads" },
    { label: "Need Based Scholarship", href: "/coordinator/need-based-scholarships" },
    { label: "Monthly Fee Vouchers", href: "/coordinator/regular-fee-vouchers" },
    { label: "Payments", href: "/coordinator/payments" },
    { label: "Fee History", href: "/coordinator/fee-history" },
    { label: "Students", href: "/coordinator/students" },
    { label: "Parents", href: "/coordinator/parents" },
    { label: "Create teacher", href: "/coordinator/teacher-create" },
    { label: "Teacher Assignments", href: "/coordinator/teacher-assignments" },
    { label: "Lecture Schedules", href: "/coordinator/lecture-schedules" },
    { label: "Lecture Verifications", href: "/coordinator/lecture-verifications" },
    { label: "Reports", href: "/coordinator/reports" },
    { label: "Sent Emails", href: "/coordinator/sent-emails" },
    { label: "Admin", href: "/coordinator/admin" },
  ],
  teacher: [
    { label: "Dashboard", href: "/teacher/dashboard" },
    { label: "All Events Calendar", href: "/teacher/class-schedulers" },
    { label: "Lectures", href: "/teacher/lectures" },
    { label: "Attendance", href: "/teacher/attendance" },
    { label: "Students", href: "/teacher/students" },
    { label: "Homework", href: "/teacher/homework" },
    { label: "Approve Homework", href: "/teacher/homework-approval" },
    { label: "Notes", href: "/teacher/notes" },
    { label: "Profile", href: "/teacher/profile" },
  ],
  parent: [
    { label: "Dashboard", href: "/parent/dashboard" },
    { label: "Events Calendar", href: "/parent/class-schedulers" },
    { label: "Lectures", href: "/parent/lectures" },
    { label: "Homework", href: "/parent/homework" },
    { label: "Attendance", href: "/parent/attendance" },
    { label: "Notes", href: "/parent/notes" },
    { label: "Fees", href: "/parent/fees" },
    { label: "Profile", href: "/parent/profile" },
  ],
  student: [
    { label: "Dashboard", href: "/student/dashboard" },
    { label: "Lectures", href: "/student/lectures" },
    { label: "Calendar", href: "/student/calendar" },
    { label: "Homework", href: "/student/homework" },
    { label: "Attendance", href: "/student/attendance" },
    { label: "Notes", href: "/student/dashboard#notes" },
    { label: "Profile", href: "/student/profile" },
  ],
};

export const roleMeta = {
  admin: { label: "Admin" },
  superadmin: { label: "Super Admin" },
  coordinator: { label: "Coordinator" },
  teacher: { label: "Teacher" },
  parent: { label: "Parent" },
  student: { label: "Student" },
};

export function getNavigationForRole(role) {
  return dashboardNavigation[String(role || "").toLowerCase()] || dashboardNavigation.student;
}





