import { createMiddleware } from "@tanstack/react-start";
import { teamsRegionAllowed } from "./teams-region";
export const requireTeamRegion = createMiddleware({ type: "function" }).server(async ({ next }) => {
  if (!teamsRegionAllowed(process.env["NODE_ENV"] === "production", process.env["SUPABASE_REGION"]))
    throw new Error("Teams is unavailable until India-region hosting is verified and configured.");
  return next();
});
