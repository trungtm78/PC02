/**
 * FCM (Firebase Cloud Messaging) error status codes returned by the
 * `fcm.googleapis.com/v1/projects/{id}/messages:send` endpoint.
 *
 * These three statuses indicate a stale or invalid token; the device row
 * should be deleted from the local DB so we stop retrying.
 *
 * Reference: https://firebase.google.com/docs/cloud-messaging/send-message#admin
 */
export const FCM_ERROR = {
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  NOT_FOUND: 'NOT_FOUND',
  UNREGISTERED: 'UNREGISTERED',
} as const;

export type FcmError = (typeof FCM_ERROR)[keyof typeof FCM_ERROR];

export const STALE_TOKEN_FCM_ERRORS: readonly FcmError[] = Object.freeze(
  Object.values(FCM_ERROR),
);
