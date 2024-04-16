import { TDbClient } from "@app/db";
import { TableName } from "@app/db/schemas";

export type TSecretSharingDALFactory = ReturnType<typeof secretSharingDALFactory>;

export const secretSharingDALFactory = (db: TDbClient) => {
  const createSharedSecret = async (sharedSecret: {
    userId: string;
    data: string;
    expiresAt: Date;
    singleUse: boolean;
  }) => {
    return db(TableName.SharedSecrets).insert(sharedSecret).returning("id");
  };

  const findAllSharedSecrets = async (userId: string) => {
    return db(TableName.SharedSecrets).where({ userId });
  };

  const findSharedSecretById = async (id: string) => {
    return db(TableName.SharedSecrets).where({ id }).first();
  };

  const deleteSharedSecretById = async (id: string) => {
    return db(TableName.SharedSecrets).where({ id }).delete();
  };

  const expireSharedSecretById = async (id: string) => {
    return db(TableName.SharedSecrets).where({ id }).update({ data: null });
  };

  return {
    createSharedSecret,
    findAllSharedSecrets,
    findSharedSecretById,
    deleteSharedSecretById,
    expireSharedSecretById
  };
};
