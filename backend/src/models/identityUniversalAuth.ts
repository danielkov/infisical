import { Document, Schema, Types, model } from "mongoose";
import { IIdentityTrustedIp } from "./identity";
import { IPType } from "../ee/models";

export const identityAccessTokenRefreshType = {
    DEFAULT: "default",
    PERIODIC: "periodic"
} as const;

export type IdentityAccessTokenRefreshType = typeof identityAccessTokenRefreshType[keyof typeof identityAccessTokenRefreshType];

export interface IIdentityUniversalAuth extends Document {
    _id: Types.ObjectId;
    identity: Types.ObjectId;
    clientId: string;
    clientSecretTrustedIps: Array<IIdentityTrustedIp>;
    accessTokenTTL: number;
    accessTokenMaxTTL: number;
    accessTokenRefreshType: IdentityAccessTokenRefreshType;
    accessTokenNumUsesLimit: number;
    accessTokenTrustedIps: Array<IIdentityTrustedIp>;
}

const identityUniversalAuthSchema = new Schema(
    {
        identity: {
            type: Schema.Types.ObjectId,
            ref: "Identity",
            required: true
        },
        clientId: {
            type: String,
            required: true
        },
        clientSecretTrustedIps: {
            type: [
                {
                    ipAddress: {
                        type: String,
                        required: true
                    },
                    type: {
                        type: String,
                        enum: [
                            IPType.IPV4,
                            IPType.IPV6
                        ],
                        required: true
                    },
                    prefix: {
                        type: Number,
                        required: false
                    }
                }
            ],
            default: [{
                ipAddress: "0.0.0.0",
                type: IPType.IPV4.toString(),
                prefix: 0
            }],
            required: true
        },
        accessTokenTTL: { // seconds
            // incremental lifetime
            type: Number,
            default: 7200,
            required: true
        },
        accessTokenMaxTTL: { // seconds
            // max lifetime
            type: Number,
            default: 7200,
            required: true
        },
        accessTokenRefreshType: {
            type: String,
            enum: [
                identityAccessTokenRefreshType.DEFAULT,
                identityAccessTokenRefreshType.PERIODIC
            ],
            default: identityAccessTokenRefreshType.DEFAULT,
            required: true
        },
        accessTokenNumUsesLimit: {
            // number of times access token can be used for
            type: Number,
            default: 0, // default: used as many times as needed
            required: true
        },
        accessTokenTrustedIps: {
            type: [
                {
                    ipAddress: {
                        type: String,
                        required: true
                    },
                    type: {
                        type: String,
                        enum: [
                            IPType.IPV4,
                            IPType.IPV6
                        ],
                        required: true
                    },
                    prefix: {
                        type: Number,
                        required: false
                    }
                }
            ],
            default: [{
                ipAddress: "0.0.0.0",
                type: IPType.IPV4.toString(),
                prefix: 0
            }],
            required: true
        }
    },
    {
        timestamps: true
    }
);

export const IdentityUniversalAuth = model<IIdentityUniversalAuth>("IdentityUniversalAuth", identityUniversalAuthSchema);