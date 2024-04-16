export const createSharedSecretUrl = (secretId: string) => {
  return `${window.location.origin}/secret-sharing/${secretId}`;
};
