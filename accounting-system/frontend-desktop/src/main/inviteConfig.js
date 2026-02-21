// Invite code configuration.
// Single universal code — activates the app for INVITE_DURATION_DAYS.
const INVITE_CODE = process.env.INVITE_CODE || 'INV-2026-AX9F3Q7M-48ZP-CKD1-PLN7-TS9X-9931';
const INVITE_DURATION_DAYS = Number(process.env.INVITE_DURATION_DAYS) || 30;

module.exports = { INVITE_CODE, INVITE_DURATION_DAYS };
