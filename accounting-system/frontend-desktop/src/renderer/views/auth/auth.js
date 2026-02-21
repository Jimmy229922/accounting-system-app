document.addEventListener('DOMContentLoaded', async () => {
    let ar = {};
    if (window.i18n && typeof window.i18n.loadArabicDictionary === 'function') {
        ar = await window.i18n.loadArabicDictionary();
    }

    function t(key, fallback = '') {
        if (window.i18n && typeof window.i18n.getText === 'function') {
            return window.i18n.getText(ar, key, fallback);
        }
        return fallback;
    }

    const form = document.getElementById('authForm');
    const titleText = document.getElementById('titleText');
    const subtitleText = document.getElementById('subtitleText');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const confirmGroup = document.getElementById('confirmGroup');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const submitBtn = document.getElementById('submitBtn');
    const statusEl = document.getElementById('status');
    const AUTH_SESSION_KEY = 'auth_session_token';

    let mode = 'login';

    function setStatus(message, type = 'info') {
        statusEl.textContent = message || '';
        statusEl.classList.remove('error', 'success');
        if (type === 'error') {
            statusEl.classList.add('error');
        }
        if (type === 'success') {
            statusEl.classList.add('success');
        }
    }

    function showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'auth-loading-overlay';
        overlay.innerHTML = `
            <div class="auth-loading-spinner"></div>
            <div class="auth-loading-text">${t('auth.loading', 'جاري تحميل النظام...')}</div>
        `;
        document.body.appendChild(overlay);
    }

    function storeSessionToken(token) {
        if (!token) return;
        try {
            if (window.electronAPI && typeof window.electronAPI.setAuthSessionToken === 'function') {
                window.electronAPI.setAuthSessionToken(token);
            }
            localStorage.setItem(AUTH_SESSION_KEY, token);
        } catch (error) {
            // Ignore localStorage errors and continue auth flow.
        }
    }

    function applyMode(nextMode) {
        mode = nextMode;

        if (mode === 'setup') {
            titleText.textContent = t('auth.setupTitle', 'تفعيل حساب النظام');
            subtitleText.textContent = t('auth.setupSubtitle', 'هذه أول مرة تشغيل. أنشئ اسم مستخدم وكلمة مرور للحماية.');
            submitBtn.textContent = t('auth.setupBtn', 'تفعيل الحساب');
            confirmGroup.hidden = false;
            passwordInput.setAttribute('autocomplete', 'new-password');
            confirmPasswordInput.required = true;
        } else {
            titleText.textContent = t('auth.loginTitle', 'تسجيل الدخول');
            subtitleText.textContent = t('auth.loginSubtitle', 'ادخل اسم المستخدم وكلمة المرور للمتابعة.');
            submitBtn.textContent = t('auth.loginBtn', 'دخول');
            confirmGroup.hidden = true;
            passwordInput.setAttribute('autocomplete', 'current-password');
            confirmPasswordInput.required = false;
            confirmPasswordInput.value = '';
        }
    }

    async function init() {
        try {
            const authStatus = await window.electronAPI.getAuthStatus();
            if (authStatus.requiresSetup) {
                applyMode('setup');
            } else {
                applyMode('login');
                if (authStatus.username) {
                    usernameInput.value = authStatus.username;
                    usernameInput.select();
                }
            }
        } catch (error) {
            applyMode('setup');
            setStatus(t('auth.errors.authCheckFailed', 'تعذر قراءة حالة الحساب. أنشئ حساب جديد للمتابعة.'), 'error');
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus('');

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!username || !password) {
            setStatus(t('auth.errors.usernamePasswordRequired', 'يرجى إدخال اسم المستخدم وكلمة المرور.'), 'error');
            return;
        }

        if (mode === 'setup' && password !== confirmPassword) {
            setStatus(t('auth.errors.passwordMismatch', 'كلمة المرور وتأكيدها غير متطابقين.'), 'error');
            return;
        }

        submitBtn.disabled = true;

        try {
            if (mode === 'setup') {
                const setupResult = await window.electronAPI.setupAuthAccount({
                    username,
                    password
                });

                if (!setupResult.success) {
                    setStatus(setupResult.error || t('auth.errors.setupFailed', 'فشل تفعيل الحساب.'), 'error');
                    return;
                }

                storeSessionToken(setupResult.sessionToken);
                try { sessionStorage.removeItem('user_permissions_cache'); } catch (e) { /* ignore */ }
                setStatus(t('auth.success.setupDone', 'تم تفعيل الحساب بنجاح. جاري الدخول...'), 'success');
                showLoadingOverlay();
                setTimeout(() => window.electronAPI.notifyAuthUnlocked(), 600);
                return;
            }

            const loginResult = await window.electronAPI.loginAuthAccount({
                username,
                password
            });

            if (!loginResult.success) {
                setStatus(loginResult.error || t('auth.errors.loginFailed', 'بيانات الدخول غير صحيحة.'), 'error');
                return;
            }

            storeSessionToken(loginResult.sessionToken);
            try { sessionStorage.removeItem('user_permissions_cache'); } catch (e) { /* ignore */ }
            setStatus(t('auth.success.loginDone', 'تم تسجيل الدخول بنجاح.'), 'success');
            showLoadingOverlay();
            setTimeout(() => window.electronAPI.notifyAuthUnlocked(), 600);
        } catch (error) {
            setStatus(t('auth.errors.loginError', 'حدث خطأ أثناء التحقق من بيانات الدخول.'), 'error');
        } finally {
            submitBtn.disabled = false;
            passwordInput.value = '';
            confirmPasswordInput.value = '';
        }
    });

    init();
});
