import { cookies } from "next/headers";
import { createClient } from "./server";
import { listEvents } from "./events";
import { listProjects } from "./projects";
import type { Project } from "@/utils/projects";
import type { BoroughEvent } from "@/utils/events";

export type TrendingItem =
  | { kind: "event"; id: string; views: number; event: BoroughEvent }
  | { kind: "project"; id: string; views: number; project: Project };

export type TrendingResult = { items: TrendingItem[]; hasTraffic: boolean };

type TrendRow = {
  content_type: "event" | "project";
  content_id: string;
  views: number | string;
};

/** Upcoming events and one project, used honestly as discovery until traffic exists. */
function discovery(
  events: BoroughEvent[],
  projects: Project[],
  limit: number,
): TrendingItem[] {
  const items: TrendingItem[] = [];
  if (projects[0]) {
    items.push({ kind: "project", id: projects[0].slug, views: 0, project: projects[0] });
  }
  for (const event of events) {
    items.push({ kind: "event", id: event.id, views: 0, event });
    if (items.length >= limit) break;
  }
  return items.slice(0, limit);
}

/** Hydrate the database rank with the published projects and current event feed. */
export async function listTrendingContent(limit = 4): Promise<TrendingResult> {
  const [events, projects, cookieStore] = await Promise.all([
    listEvents(),
    listProjects(),
    cookies(),
  ]);
  const supabase = createClient(cookieStore);
  const { data, error } = await supabase.rpc("trending_content", {
    p_limit: Math.min(Math.max(limit * 3, limit), 20),
  });

  if (error || !data || data.length === 0) {
    return { items: discovery(events, projects, limit), hasTraffic: false };
  }

  const eventById = new Map(events.map((event) => [event.id, event]));
  const projectBySlug = new Map(projects.map((project) => [project.slug, project]));
  const items: TrendingItem[] = [];

  for (const row of data as TrendRow[]) {
    if (row.content_type === "event") {
      const event = eventById.get(row.content_id);
      if (event) items.push({ kind: "event", id: event.id, views: Number(row.views), event });
    } else {
      const project = projectBySlug.get(row.content_id);
      if (project) items.push({ kind: "project", id: project.slug, views: Number(row.views), project });
    }
    if (items.length >= limit) break;
  }

  return items.length > 0
    ? { items, hasTraffic: true }
    : { items: discovery(events, projects, limit), hasTraffic: false };
}
