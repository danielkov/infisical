import { z } from "zod";
import { verifyAuth } from "@app/server/plugins/auth/verify-auth";
import { AuthMode } from "@app/services/auth/auth-type";
import { readLimit } from "@app/server/config/rateLimiter";

export const registerSecretSharingRouter = async (server: FastifyZodProvider) => {
  // list user's shared secrets
  server.route({
    method: "GET",
    url: "/",
    config: {
      rateLimit: readLimit
    },
    schema: {
      params: z.object({}),
      response: {
        200: z.array(
          z.object({
            id: z.string().uuid(),
            userId: z.string().uuid(),
            createdAt: z.date(),
            expiresAt: z.date(),
            singleUse: z.boolean(),
            expired: z.boolean(),
            data: z.string().nullable()
          })
        )
      }
    },
    onRequest: verifyAuth([AuthMode.JWT]),
    handler: async (req) => {
      // get all the shared secrets for the user
      const sharedSecrets = await req.server.services.secretSharing.getSharedSecrets(req.permission.id);

      return sharedSecrets;
    }
  });

  // create a shared secret
  server.route({
    method: "POST",
    url: "/",
    config: {
      rateLimit: readLimit
    },
    schema: {
      body: z.object({
        data: z.string().nonempty(),
        expiresAt: z.string().refine((date) => new Date(date) > new Date(), {
          message: "Expires at should be a future date"
        }),
        singleUse: z.boolean()
      }),
      response: {
        200: z.object({
          id: z.string().uuid()
        })
      }
    },
    onRequest: verifyAuth([AuthMode.JWT]),
    handler: async (req) => {
      const { data, expiresAt, singleUse } = req.body;

      // create the shared secret
      const sharedSecret = await req.server.services.secretSharing.createSharedSecret({
        userId: req.permission.id,
        data,
        expiresAt: new Date(expiresAt),
        singleUse
      });

      return { id: sharedSecret.id };
    }
  });

  // get a shared secret by id - this will also expire the secret if it is single use
  // does not require auth
  server.route({
    method: "GET",
    url: "/:id",
    config: {
      rateLimit: readLimit
    },
    schema: {
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          id: z.string().uuid(),
          userId: z.string().uuid(),
          expiresAt: z.date(),
          singleUse: z.boolean(),
          expired: z.boolean(),
          data: z.string().nullable()
        })
      }
    },
    handler: async (req, reply) => {
      // get the secret
      try {
        const secret = await req.server.services.secretSharing.getSharedSecretById(req.params.id);
        // 404 if secret expired
        if (secret.expired) {
          return reply.callNotFound();
        }

        return secret;
      } catch {
        return reply.callNotFound();
      }
    }
  });

  server.route({
    method: "PATCH",
    url: "/expire/:id",
    config: {
      rateLimit: readLimit
    },
    schema: {
      params: z.object({
        id: z.string().uuid()
      }),
      response: {
        200: z.object({
          success: z.boolean()
        })
      }
    },
    onRequest: verifyAuth([AuthMode.JWT]),
    handler: async (req) => {
      await req.server.services.secretSharing.expireSharedSecretById(req.params.id);

      return { success: true };
    }
  });
};
