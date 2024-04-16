export type SharedSecret =
  | {
      id: string;
      createdAt: number;
      expiresAt: number;
      expired: false;
      data: string;
    }
  | {
      id: string;
      createdAt: number;
      expiresAt: number;
      expired: true;
      data: null;
    };

export type CreateSharedSecret = {
  data: string;
  expiresAt: number;
  singleUse: boolean;
};
