import { redirect } from "next/navigation";

export default function StudentClassesPage() {
  redirect("/student/dashboard#lectures");
}
