export const dashboardNavigation = {
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "User Management", href: "/admin/users" },
    { label: "Subject Catalog", href: "/admin/subjects" },
    { label: "Class Management", href: "/admin/courses" },
    { label: "Fee Management", href: "/admin/fee-settings" },
    { label: "Audit History", href: "/admin/audit-logs" },
  ],
  coordinator: [
    { label: "Dashboard", href: "/coordinator/dashboard" },
    { label: "Registration Leads", href: "/coordinator/registration-leads" },
    { label: "Fee Vouchers", href: "/coordinator/fee-vouchers" },
    { label: "Payments", href: "/coordinator/payments" },
    { label: "Students", href: "/coordinator/students" },
    { label: "Parents", href: "/coordinator/parents" },
    { label: "Teacher Assignments", href: "/coordinator/teacher-assignments" },
    { label: "Lecture Schedules", href: "/coordinator/lecture-schedules" },
    { label: "Lecture Verifications", href: "/coordinator/lecture-verifications" },
    { label: "Reports", href: "/coordinator/reports" },
  ],
  teacher: [
    { label: "Dashboard", href: "/teacher/dashboard" },
    { label: "Lectures", href: "/teacher/lectures" },
    { label: "Students", href: "/teacher/students" },
    { label: "Homework", href: "/teacher/homework" },
    { label: "Notes", href: "/teacher/notes" },
    { label: "Profile", href: "/teacher/profile" },
  ],
  parent: [
    { label: "Dashboard", href: "/parent/dashboard" },
    { label: "Lectures", href: "/parent/lectures" },
    { label: "Homework", href: "/parent/homework" },
    { label: "Attendance", href: "/parent/attendance" },
    { label: "Fees", href: "/parent/fees" },
    { label: "Timeline", href: "/parent/timeline" },
    { label: "Profile", href: "/parent/profile" },
  ],
  student: [
    { label: "Dashboard", href: "/student/dashboard" },
    { label: "Lectures", href: "/student/lectures" },
    { label: "Calendar", href: "/student/calendar" },
    { label: "Homework", href: "/student/homework" },
    { label: "Attendance", href: "/student/attendance" },
    { label: "Profile", href: "/student/profile" },
  ],
};

export const roleMeta = {
  admin: { label: "Admin" },
  coordinator: { label: "Coordinator" },
  teacher: { label: "Teacher" },
  parent: { label: "Parent" },
  student: { label: "Student" },
};

export function getNavigationForRole(role) {
  return dashboardNavigation[String(role || "").toLowerCase()] || dashboardNavigation.student;
}
