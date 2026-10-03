// The only module screens import data functions from. Every function is async, typed and fake-delayed.
// MOCK: a real backend swaps these implementations for HTTP calls with the same signatures.
export * from "./admin";
export * from "./auth";
export * from "./bookings";
export * from "./branches";
export * from "./calendar";
export * from "./catalog";
export * from "./session";
export { ApiError, type ApiErrorCode } from "./core";
export { getDevConfig, setDevConfig, type DevConfig } from "../mock/dev";
