import CreateAssessmentClient from "@/components/assessments/CreateAssessmentClient";

export default function SuperadminCreateAssessmentPage() {
  return <CreateAssessmentClient portal="superadmin" readOnly={false} />;
}

