export const dashboardNavigation = {
  admin: [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "User Management", href: "/admin/users" },
    { label: "Subject Catalog", href: "/admin/subjects" },
    { label: "Course Catalog", href: "/admin/courses" },
    { label: "Fee Settings", href: "/admin/fee-settings" },
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
    { label: "Overview", href: "/teacher/dashboard" },
    { label: "Classes", href: "/teacher/classes" },
    { label: "Assignments", href: "/teacher/assignments" },
    { label: "Resources", href: "/teacher/resources" },
  ],
  parent: [
    { label: "Overview", href: "/parent/dashboard" },
    { label: "Children", href: "/parent/children" },
    { label: "Progress", href: "/parent/progress" },
    { label: "Messages", href: "/parent/messages" },
  ],
  student: [
    { label: "Overview", href: "/student/dashboard" },
    { label: "Courses", href: "/student/courses" },
    { label: "Assignments", href: "/student/assignments" },
    { label: "Schedule", href: "/student/schedule" },
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
