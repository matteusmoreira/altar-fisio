/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointmentNotifications from "../appointmentNotifications.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as authActions from "../authActions.js";
import type * as availability from "../availability.js";
import type * as bookingBuilder from "../bookingBuilder.js";
import type * as clinic from "../clinic.js";
import type * as clinical from "../clinical.js";
import type * as consents from "../consents.js";
import type * as crons from "../crons.js";
import type * as finance from "../finance.js";
import type * as lib_appointmentJobs from "../lib/appointmentJobs.js";
import type * as lib_bookGroupSession from "../lib/bookGroupSession.js";
import type * as lib_bookingSlots from "../lib/bookingSlots.js";
import type * as lib_monthlyBooking from "../lib/monthlyBooking.js";
import type * as lib_packageBookingBalance from "../lib/packageBookingBalance.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_patientCredentials from "../lib/patientCredentials.js";
import type * as lib_portalBooking from "../lib/portalBooking.js";
import type * as lib_scheduleService from "../lib/scheduleService.js";
import type * as lib_security from "../lib/security.js";
import type * as lib_validation from "../lib/validation.js";
import type * as lib_waitlist from "../lib/waitlist.js";
import type * as maintenance from "../maintenance.js";
import type * as notifications from "../notifications.js";
import type * as packages from "../packages.js";
import type * as patientPortal from "../patientPortal.js";
import type * as patients from "../patients.js";
import type * as portalAccess from "../portalAccess.js";
import type * as portalAuth from "../portalAuth.js";
import type * as professionals from "../professionals.js";
import type * as rooms from "../rooms.js";
import type * as schedules from "../schedules.js";
import type * as security from "../security.js";
import type * as seed from "../seed.js";
import type * as services from "../services.js";
import type * as waitlist from "../waitlist.js";
import type * as whatsapp from "../whatsapp.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appointmentNotifications: typeof appointmentNotifications;
  audit: typeof audit;
  auth: typeof auth;
  authActions: typeof authActions;
  availability: typeof availability;
  bookingBuilder: typeof bookingBuilder;
  clinic: typeof clinic;
  clinical: typeof clinical;
  consents: typeof consents;
  crons: typeof crons;
  finance: typeof finance;
  "lib/appointmentJobs": typeof lib_appointmentJobs;
  "lib/bookGroupSession": typeof lib_bookGroupSession;
  "lib/bookingSlots": typeof lib_bookingSlots;
  "lib/monthlyBooking": typeof lib_monthlyBooking;
  "lib/packageBookingBalance": typeof lib_packageBookingBalance;
  "lib/password": typeof lib_password;
  "lib/patientCredentials": typeof lib_patientCredentials;
  "lib/portalBooking": typeof lib_portalBooking;
  "lib/scheduleService": typeof lib_scheduleService;
  "lib/security": typeof lib_security;
  "lib/validation": typeof lib_validation;
  "lib/waitlist": typeof lib_waitlist;
  maintenance: typeof maintenance;
  notifications: typeof notifications;
  packages: typeof packages;
  patientPortal: typeof patientPortal;
  patients: typeof patients;
  portalAccess: typeof portalAccess;
  portalAuth: typeof portalAuth;
  professionals: typeof professionals;
  rooms: typeof rooms;
  schedules: typeof schedules;
  security: typeof security;
  seed: typeof seed;
  services: typeof services;
  waitlist: typeof waitlist;
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
