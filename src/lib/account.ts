import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getAccountData } from "./data.functions";
export const accountOptions = queryOptions({
  queryKey: ["account"],
  queryFn: () => getAccountData(),
  staleTime: 30000,
});
export const useAccount = () => useSuspenseQuery(accountOptions).data;
