// Invite code configuration. Set INVITE_CODE via environment variable for production security.
// Default invite code (override with ENV: INVITE_CODE). Keep long/unguessable.
const INVITE_CODE = process.env.INVITE_CODE || 'INV-2026-AX9F3Q7M-48ZP-CKD1-PLN7-TS9X-9931';
const INVITE_DURATION_DAYS = 30;

module.exports = { INVITE_CODE, INVITE_DURATION_DAYS };
