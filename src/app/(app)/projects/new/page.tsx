import { NewProjectForm } from "@/components/new-project-form";

export const dynamic = "force-dynamic";

export default function NewProjectPage() {
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1>New Project</h1>
          <div className="sub">프로젝트 등록 · HQ 자동 분배 · project/agent threadKey 생성</div>
        </div>
      </div>
      <NewProjectForm />
    </>
  );
}
