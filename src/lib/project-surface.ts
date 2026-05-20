export type ProjectSurfaceAgent = {
  id: string;
  slug: string;
  name: string;
};

export type ProjectSurfaceTask = {
  id: string;
  title: string;
  status: string;
  agent: ProjectSurfaceAgent | null;
};

export type ProjectSurfaceProject = {
  id: string;
  slug: string;
  name: string;
  status: string;
  revenueType: string | null;
  nextAction: string | null;
  blocker: string | null;
  updatedAt: Date;
  tasks: ProjectSurfaceTask[];
};

export type ProjectSurfaceCard = ProjectSurfaceProject & {
  assignmentCount: number;
  activeAssignmentCount: number;
};

export type ProjectAgentSection = {
  agentId: string;
  agentSlug: string;
  agentName: string;
  projects: ProjectSurfaceCard[];
};

const ACTIVE_TASK_STATUSES = new Set(["created", "classified", "planned", "waiting_approval", "queued", "claimed", "running", "tool_wait", "verifying", "blocked", "retry_scheduled", "needs_changes"]);

function compareProjectUpdatedAt(a: Pick<ProjectSurfaceProject, "updatedAt">, b: Pick<ProjectSurfaceProject, "updatedAt">) {
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function toCard(project: ProjectSurfaceProject, tasks: ProjectSurfaceTask[]): ProjectSurfaceCard {
  return {
    ...project,
    tasks,
    assignmentCount: tasks.length,
    activeAssignmentCount: tasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.status)).length
  };
}

export function buildProjectSurface(projects: ProjectSurfaceProject[]) {
  const sortedProjects = [...projects].sort(compareProjectUpdatedAt);
  const agentSections = new Map<string, ProjectAgentSection>();

  for (const project of sortedProjects) {
    const tasksByAgent = new Map<string, { agent: ProjectSurfaceAgent; tasks: ProjectSurfaceTask[] }>();
    for (const task of project.tasks) {
      if (!task.agent) continue;
      const existing = tasksByAgent.get(task.agent.id) ?? { agent: task.agent, tasks: [] };
      existing.tasks.push(task);
      tasksByAgent.set(task.agent.id, existing);
    }

    for (const { agent, tasks } of tasksByAgent.values()) {
      const section = agentSections.get(agent.id) ?? {
        agentId: agent.id,
        agentSlug: agent.slug,
        agentName: agent.name,
        projects: []
      };
      section.projects.push(toCard(project, tasks));
      agentSections.set(agent.id, section);
    }
  }

  return {
    allProjects: sortedProjects.map((project) => toCard(project, project.tasks)),
    byAgent: [...agentSections.values()].sort((a, b) => a.agentSlug.localeCompare(b.agentSlug))
  };
}
