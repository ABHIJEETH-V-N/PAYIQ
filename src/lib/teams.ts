import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getTeams } from "./teams.functions";
export const teamsOptions = queryOptions({
  queryKey: ["teams"],
  queryFn: () => getTeams(),
  staleTime: 10000,
});
export const useTeams = () => useSuspenseQuery(teamsOptions).data;
export type TeamRecord = Awaited<ReturnType<typeof getTeams>>["records"][number];
export const recordData = (record: TeamRecord): Record<string, unknown> =>
  record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data : {};
