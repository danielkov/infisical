import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@app/config/request";

import { SharedSecret } from "./types";

const fetchAllSharedSecrets = async () => {
  const { data } = await apiRequest.get<SharedSecret[]>("/api/v1/secret-sharing");

  return data;
};

export const fetchSharedSecret = async (secretId: string) => {
  const { data } = await apiRequest.get<SharedSecret>(`/api/v1/secret-sharing/${secretId}`);

  return data;
};

export const useSharedSecrets = () => {
  return useQuery({
    queryKey: ["sharedSecrets"],
    queryFn: fetchAllSharedSecrets
  });
};

export const useSharedSecret = (secretId: string) => {
  return useQuery({
    enabled: Boolean(secretId),
    queryKey: ["sharedSecret", secretId],
    queryFn: () => fetchSharedSecret(secretId)
  });
};
