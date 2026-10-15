import { api } from '@/lib/api';
import type { Project } from '@/types';

export async function fetchAllProjects(): Promise<Project[]> {
  const projects: Project[] = [];
  for (let page = 1; page <= 501; page += 1) {
    const response = await api.get('/projects', { params: { page, limit: 200 } });
    if (!response.data.success || !Array.isArray(response.data.projects)) {
      throw new Error('Unable to load projects.');
    }
    projects.push(...(response.data.projects as Project[]));
    if (!response.data.hasMore) return projects;
  }
  throw new Error('The workspace has more projects than can be loaded at once.');
}
