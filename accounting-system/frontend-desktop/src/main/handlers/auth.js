const { ipcMain } = require('electron');
const crypto = require('crypto');
const { db } = require('../db');
const { INVITE_CODE, INVITE_DURATION_DAYS } = require('../inviteConfig');

function normalizeUsername(username) {
    return String(username || '').trim();
}

function validateCredentials(username, password) {
    if (!username) {
        return 'يرجى إدخال اسم المستخدم.';
    }

    if (username.length < 3 || username.length > 32) {
        return 'اسم المستخدم يجب أن يكون بين 3 و 32 حرف.';
    }

    if (!password || password.length < 6) {
        return 'كلمة المرور يجب أن تكون 6 حروف أو أكثر.';
    }

    return null;
}

function getAuthRecord() {
    const rows = db.prepare(`
        SELECT key, value
        FROM settings
        WHERE key IN ('auth_username', 'auth_password_salt', 'auth_password_hash')
    `).all();

    const map = {};
    rows.forEach((row) => {
        map[row.key] = row.value;
    });

    const username = map.auth_username || '';
    const salt = map.auth_password_salt || '';
    const hash = map.auth_password_hash || '';
    const hasAccount = Boolean(username && salt && hash);

    return {
        username,
        salt,
        hash,
        hasAccount
    };
}

function hashPassword(password, saltHex) {
    return crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64).toString('hex');
}

function safeCompareHash(expectedHex, receivedHex) {
    const expected = Buffer.from(expectedHex, 'hex');
    const received = Buffer.from(receivedHex, 'hex');

    if (expected.length !== received.length) {
        return false;
    }

    return crypto.timingSafeEqual(expected, received);
}

// ── Hardcoded Super Admin (never deleted, never deactivated) ──
const SUPER_ADMIN_USERNAME = 'Jimmy';
const SUPER_ADMIN_PASSWORD = 'A7med1221';

let activeAuthUser = null;

function ensureAuthUsersTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS auth_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_salt TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            last_login_at TEXT
        )
    `);
}

function getSettingsMap(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
        return {};
    }

    const placeholders = keys.map(() => '?').join(', ');
    const rows = db.prepare(`SELECT key, value FROM settings WHERE key IN (${placeholders})`).all(...keys);
    const map = {};
    rows.forEach((row) => {
        map[row.key] = row.value;
    });
    return map;
}

function mapAuthUser(row) {
    if (!row) return null;
    return {
        id: Number(row.id),
        username: row.username,
        isAdmin: Boolean(Number(row.is_admin)),
        isActive: Boolean(Number(row.is_active)),
        createdAt: row.created_at || null,
        lastLoginAt: row.last_login_at || null
    };
}

function setActiveAuthUser(row) {
    activeAuthUser = mapAuthUser(row);
}

function getActiveAuthUser() {
    return activeAuthUser ? { ...activeAuthUser } : null;
}

function getAuthUsersCount() {
    ensureAuthUsersTable();
    const row = db.prepare('SELECT COUNT(*) AS count FROM auth_users').get();
    return Number(row?.count || 0);
}

function ensureSuperAdmin() {
    ensureAuthUsersTable();
    const existing = getAuthUserByUsername(SUPER_ADMIN_USERNAME);
    if (existing) {
        // Make sure super admin is always admin + active
        if (!Number(existing.is_admin) || !Number(existing.is_active)) {
            db.prepare('UPDATE auth_users SET is_admin = 1, is_active = 1 WHERE id = ?').run(existing.id);
        }
        return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(SUPER_ADMIN_PASSWORD, salt);
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO auth_users (
            username, password_salt, password_hash,
            is_admin, is_active, created_at, last_login_at
        ) VALUES (?, ?, ?, 1, 1, ?, ?)
    `).run(SUPER_ADMIN_USERNAME, salt, passwordHash, now, now);
}

function isSuperAdmin(userId) {
    const user = getAuthUserById(userId);
    if (!user) return false;
    return user.username.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase();
}

function migrateLegacyAuthRecordIfNeeded() {
    ensureAuthUsersTable();
    ensureSuperAdmin();

    if (getAuthUsersCount() > 0) {
        return;
    }

    const legacy = getAuthRecord();
    if (!legacy.hasAccount) {
        return;
    }

    const now = new Date().toISOString();
    const settingsMap = getSettingsMap(['auth_created_at', 'auth_last_login_at']);
    const createdAt = settingsMap.auth_created_at || now;
    const lastLoginAt = settingsMap.auth_last_login_at || createdAt;

    db.prepare(`
        INSERT INTO auth_users (
            username,
            password_salt,
            password_hash,
            is_admin,
            is_active,
            created_at,
            last_login_at
        )
        VALUES (?, ?, ?, 1, 1, ?, ?)
    `).run(
        legacy.username,
        legacy.salt,
        legacy.hash,
        createdAt,
        lastLoginAt
    );
}

function getAuthUserByUsername(username) {
    ensureAuthUsersTable();
    return db.prepare('SELECT * FROM auth_users WHERE lower(username) = lower(?) LIMIT 1').get(username);
}

function getAuthUserById(id) {
    ensureAuthUsersTable();
    return db.prepare('SELECT * FROM auth_users WHERE id = ?').get(id);
}

function listAuthUsers() {
    ensureAuthUsersTable();
    return db.prepare(`
        SELECT id, username, is_admin, is_active, created_at, last_login_at
        FROM auth_users
        ORDER BY is_admin DESC, username ASC
    `).all();
}

function getPrimaryAuthUsername() {
    ensureAuthUsersTable();
    const preferred = db.prepare(`
        SELECT username
        FROM auth_users
        WHERE is_admin = 1
        ORDER BY id ASC
        LIMIT 1
    `).get();

    if (preferred?.username) {
        return preferred.username;
    }

    const anyUser = db.prepare('SELECT username FROM auth_users ORDER BY id ASC LIMIT 1').get();
    return anyUser?.username || null;
}

function ensureAuthSessionsTable() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        )
    `);
}

function purgeExpiredAuthSessions() {
    ensureAuthSessionsTable();
    const now = new Date().toISOString();
    db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').run(now);
}

function createAuthSession(userId) {
    ensureAuthSessionsTable();
    purgeExpiredAuthSessions();

    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const expiresIso = expiresAt.toISOString();

    db.prepare(`
        INSERT INTO auth_sessions (token, user_id, created_at, last_seen_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(token, userId, nowIso, nowIso, expiresIso);

    return token;
}

function extractSessionToken(payload) {
    if (typeof payload === 'string') {
        return payload.trim();
    }

    if (payload && typeof payload.sessionToken === 'string') {
        return payload.sessionToken.trim();
    }

    return '';
}

function getSessionUser(sessionToken) {
    if (!sessionToken) {
        return null;
    }

    ensureAuthSessionsTable();
    purgeExpiredAuthSessions();
    const now = new Date().toISOString();

    const row = db.prepare(`
        SELECT u.*
        FROM auth_sessions s
        JOIN auth_users u ON u.id = s.user_id
        WHERE s.token = ?
          AND s.expires_at > ?
        LIMIT 1
    `).get(sessionToken, now);

    if (!row) {
        return null;
    }

    db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE token = ?').run(now, sessionToken);
    return row;
}

function requireAdminSession(sessionToken = '') {
    const tokenUser = mapAuthUser(getSessionUser(sessionToken));
    const session = tokenUser || getActiveAuthUser();
    if (!session) {
        return { ok: false, error: 'يرجى تسجيل الدخول أولاً.' };
    }

    if (!session.isAdmin) {
        return { ok: false, error: 'هذه العملية متاحة لحساب الأدمن فقط.' };
    }

    return { ok: true, session };
}

function persistLegacyAuthSnapshot({ username, salt, hash, createdAt, lastLoginAt }) {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
    stmt.run({ key: 'auth_username', value: username });
    stmt.run({ key: 'auth_password_salt', value: salt });
    stmt.run({ key: 'auth_password_hash', value: hash });
    stmt.run({ key: 'auth_created_at', value: createdAt });
    stmt.run({ key: 'auth_last_login_at', value: lastLoginAt });
}

function register() {
    // Auth Handlers
    ipcMain.handle('get-auth-status', () => {
        migrateLegacyAuthRecordIfNeeded();
        const hasAccount = getAuthUsersCount() > 0;
        return {
            hasAccount,
            requiresSetup: !hasAccount,
            username: hasAccount ? getPrimaryAuthUsername() : null
        };
    });

    ipcMain.handle('setup-auth-account', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        if (getAuthUsersCount() > 0) {
            return { success: false, error: 'يوجد حساب مفعل مسبقاً.' };
        }

        const username = normalizeUsername(payload.username);
        const password = String(payload.password || '');
        const validationError = validateCredentials(username, password);

        if (validationError) {
            return { success: false, error: validationError };
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const now = new Date().toISOString();

        try {
            const tx = db.transaction(() => {
                ensureAuthUsersTable();
                db.prepare(`
                    INSERT INTO auth_users (
                        username,
                        password_salt,
                        password_hash,
                        is_admin,
                        is_active,
                        created_at,
                        last_login_at
                    )
                    VALUES (?, ?, ?, 1, 1, ?, ?)
                `).run(username, salt, passwordHash, now, now);

                persistLegacyAuthSnapshot({
                    username,
                    salt,
                    hash: passwordHash,
                    createdAt: now,
                    lastLoginAt: now
                });
            });
            tx();

            const createdUser = getAuthUserByUsername(username);
            setActiveAuthUser(createdUser);
            const sessionToken = createAuthSession(createdUser.id);
            return { success: true, username, isAdmin: true, sessionToken };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('login-auth-account', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        if (getAuthUsersCount() === 0) {
            return { success: false, error: 'لا يوجد حساب مفعل. يرجى إنشاء الحساب أولاً.' };
        }

        const username = normalizeUsername(payload.username);
        const password = String(payload.password || '');

        if (!username || !password) {
            return { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور.' };
        }

        const authUser = getAuthUserByUsername(username);
        if (!authUser) {
            return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
        }

        if (!Number(authUser.is_active)) {
            return { success: false, error: 'الحساب غير مفعل. يرجى الرجوع إلى مسؤول النظام.' };
        }

        try {
            const receivedHash = hashPassword(password, authUser.password_salt);
            const isValid = safeCompareHash(authUser.password_hash, receivedHash);
            if (!isValid) {
                return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' };
            }

            const now = new Date().toISOString();
            db.prepare('UPDATE auth_users SET last_login_at = ? WHERE id = ?').run(now, authUser.id);
            db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
                .run('auth_last_login_at', now);

            const updatedUser = getAuthUserById(authUser.id);
            setActiveAuthUser(updatedUser);
            const sessionToken = createAuthSession(updatedUser.id);
            return {
                success: true,
                username: updatedUser.username,
                isAdmin: Boolean(Number(updatedUser.is_admin)),
                sessionToken
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('get-active-auth-user', (event, payload = {}) => {
        const sessionToken = extractSessionToken(payload);
        const userFromToken = mapAuthUser(getSessionUser(sessionToken));
        return userFromToken || getActiveAuthUser();
    });

    ipcMain.handle('get-auth-users', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        const sessionToken = extractSessionToken(payload);
        const auth = requireAdminSession(sessionToken);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }

        const users = listAuthUsers().map((row) => mapAuthUser(row));
        return {
            success: true,
            users,
            activeUserId: auth.session.id
        };
    });

    ipcMain.handle('create-auth-user', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        const sessionToken = extractSessionToken(payload);
        const auth = requireAdminSession(sessionToken);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }

        const username = normalizeUsername(payload.username);
        const password = String(payload.password || '');
        const isActive = Boolean(payload.isActive);
        const validationError = validateCredentials(username, password);

        if (validationError) {
            return { success: false, error: validationError };
        }

        const existing = getAuthUserByUsername(username);
        if (existing) {
            return { success: false, error: 'اسم المستخدم موجود بالفعل.' };
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const now = new Date().toISOString();

        try {
            const info = db.prepare(`
                INSERT INTO auth_users (
                    username,
                    password_salt,
                    password_hash,
                    is_admin,
                    is_active,
                    created_at,
                    last_login_at
                )
                VALUES (?, ?, ?, 0, ?, ?, NULL)
            `).run(username, salt, passwordHash, isActive ? 1 : 0, now);

            const createdUser = getAuthUserById(Number(info.lastInsertRowid));
            return {
                success: true,
                user: mapAuthUser(createdUser)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('set-auth-user-active', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        const sessionToken = extractSessionToken(payload);
        const auth = requireAdminSession(sessionToken);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }

        const userId = Number(payload.userId);
        const isActive = Boolean(payload.isActive);

        if (!userId) {
            return { success: false, error: 'معرف المستخدم غير صالح.' };
        }

        const targetUser = getAuthUserById(userId);
        if (!targetUser) {
            return { success: false, error: 'المستخدم غير موجود.' };
        }

        if (isSuperAdmin(userId)) {
            return { success: false, error: 'لا يمكن تعديل حالة حساب السوبر أدمن.' };
        }

        if (Number(targetUser.id) === Number(auth.session.id) && !isActive) {
            return { success: false, error: 'لا يمكن تعطيل الحساب الحالي.' };
        }

        if (Number(targetUser.is_admin) === 1 && !isActive) {
            const adminsRow = db.prepare('SELECT COUNT(*) AS count FROM auth_users WHERE is_admin = 1 AND is_active = 1').get();
            if (Number(adminsRow?.count || 0) <= 1 && Number(targetUser.is_active) === 1) {
                return { success: false, error: 'لا يمكن تعطيل آخر حساب أدمن مفعل.' };
            }
        }

        try {
            db.prepare('UPDATE auth_users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, userId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('reset-auth-user-password', (event, payload = {}) => {
        migrateLegacyAuthRecordIfNeeded();
        const sessionToken = extractSessionToken(payload);
        const auth = requireAdminSession(sessionToken);
        if (!auth.ok) {
            return { success: false, error: auth.error };
        }

        const userId = Number(payload.userId);
        const newPassword = String(payload.newPassword || '');

        if (!userId) {
            return { success: false, error: 'معرف المستخدم غير صالح.' };
        }

        if (!newPassword || newPassword.length < 6) {
            return { success: false, error: 'كلمة المرور يجب أن تكون 6 حروف أو أكثر.' };
        }

        const targetUser = getAuthUserById(userId);
        if (!targetUser) {
            return { success: false, error: 'المستخدم غير موجود.' };
        }

        if (isSuperAdmin(userId)) {
            return { success: false, error: 'لا يمكن تغيير كلمة مرور حساب السوبر أدمن.' };
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(newPassword, salt);

        try {
            db.prepare('UPDATE auth_users SET password_salt = ?, password_hash = ? WHERE id = ?')
                .run(salt, passwordHash, userId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Invite Code Handlers
    ipcMain.handle('get-invite-status', () => {
        const rows = db.prepare("SELECT * FROM settings WHERE key IN ('invite_code', 'invite_expiry')").all();
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });

        const expiry = map.invite_expiry ? new Date(map.invite_expiry) : null;
        const now = new Date();
        const withinRange = expiry ? expiry > now : false;

        // If expiry is still valid, accept regardless of code changes
        const codeMatches = withinRange ? true : map.invite_code === INVITE_CODE;

        return {
            valid: codeMatches && withinRange,
            codeMatches,
            expiry: map.invite_expiry || null,
            requiresCode: !codeMatches || !withinRange
        };
    });

    ipcMain.handle('submit-invite-code', (event, code) => {
        if (!code || code.trim() !== INVITE_CODE) {
            return { success: false, error: 'كود الدعوة غير صحيح.' };
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITE_DURATION_DAYS);

        try {
            const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (@key, @value)');
            const tx = db.transaction(() => {
                stmt.run({ key: 'invite_code', value: INVITE_CODE });
                stmt.run({ key: 'invite_expiry', value: expiresAt.toISOString() });
            });
            tx();
            return { success: true, expiresAt: expiresAt.toISOString() };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
