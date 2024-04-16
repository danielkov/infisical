import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "@app/config/request";

import { CreateSharedSecret } from "./types";

const createSharedSecret = async (data: CreateSharedSecret) => {
  const response = await apiRequest.post("/api/v1/secret-sharing", data);
  return response.data;
};

const expireSharedSecret = async (id: string) => {
  await apiRequest.patch(`/api/v1/secret-sharing/expire/${id}`);
};

export const useCreateSharedSecret = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSharedSecret,
    onSuccess: () => queryClient.invalidateQueries(["sharedSecrets"])
  });
};

export const useExpireSharedSecret = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: expireSharedSecret,
    onSuccess: () => queryClient.invalidateQueries(["sharedSecrets"])
  });
};
