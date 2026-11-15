export function teamsRegionAllowed(production: boolean, region: string | undefined): boolean {
  return !production || ["ap-south-1", "ap-south-2"].includes(region ?? "");
}
