import { TSecretSharingDALFactory } from "./secret-sharing-dal";

type TSecretSharingServiceFactoryDep = {
  secretSharingDAL: TSecretSharingDALFactory;
};

export type TSecretSharingServiceFactory = ReturnType<typeof secretSharingServiceFactory>;

const mapSharedSecretExpiry = (
  shared: {
    id: string;
    userId: string;
    createdAt: Date;
    expiresAt: Date;
    singleUse: boolean;
    data: string | null;
  },
  now: Date
) => {
  const expired = shared.expiresAt < now || shared.data === null;
  return {
    id: shared.id,
    userId: shared.userId,
    createdAt: shared.createdAt,
    expiresAt: shared.expiresAt,
    singleUse: shared.singleUse,
    expired,
    data: expired ? null : shared.data
  };
};

export const secretSharingServiceFactory = ({ secretSharingDAL }: TSecretSharingServiceFactoryDep) => {
  const createSharedSecret = async (data: { userId: string; data: string; expiresAt: Date; singleUse: boolean }) => {
    return (await secretSharingDAL.createSharedSecret(data))[0];
  };

  const getSharedSecrets = async (userId: string) => {
    const now = new Date();
    return (await secretSharingDAL.findAllSharedSecrets(userId)).map((shared) => mapSharedSecretExpiry(shared, now));
  };

  const getSharedSecretById = async (id: string) => {
    const now = new Date();
    const result = await secretSharingDAL.findSharedSecretById(id);
    if (!result) {
      throw new Error("Shared secret not found");
    }

    const data = mapSharedSecretExpiry(result, now);

    // lazy expiry: the data is formally removed on the first access after expiry
    // this is also where we expire single use secrets, difference is, their data will not be removed
    // the first time around
    if (data.expired || data.singleUse) {
      await secretSharingDAL.expireSharedSecretById(id);
    }

    return data;
  };

  const expireSharedSecretById = async (id: string) => {
    await secretSharingDAL.expireSharedSecretById(id);
  };

  return {
    createSharedSecret,
    getSharedSecrets,
    getSharedSecretById,
    expireSharedSecretById
  };
};
