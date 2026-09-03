/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as bookingBuilder from "../bookingBuilder.js";
import type * as clinic from "../clinic.js";
import type * as clinical from "../clinical.js";
import type * as consents from "../consents.js";
import type * as crons from "../crons.js";
import type * as finance from "../finance.js";
import type * as notifications from "../notifications.js";
import type * as packages from "../packages.js";
import type * as patients from "../patients.js";
import type * as professionals from "../professionals.js";
import type * as rooms from "../rooms.js";
import type * as schedules from "../schedules.js";
import type * as seed from "../seed.js";
import type * as services from "../services.js";
import type * as whatsapp from "../whatsapp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  auth: typeof auth;
  bookingBuilder: typeof bookingBuilder;
  clinic: typeof clinic;
  clinical: typeof clinical;
  consents: typeof consents;
  crons: typeof crons;
  finance: typeof finance;
  notifications: typeof notifications;
  packages: typeof packages;
  patients: typeof patients;
  professionals: typeof professionals;
  rooms: typeof rooms;
  schedules: typeof schedules;
  seed: typeof seed;
  services: typeof services;
  whatsapp: typeof whatsapp;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
