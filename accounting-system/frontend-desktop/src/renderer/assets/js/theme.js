// Theme Management (without navbar injection)
function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light';
}

function setTheme(theme) {
    const safeTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', safeTheme);
    localStorage.setItem('theme', safeTheme);
    syncThemeToggleButtons();
}

function toggleTheme() {
    const newTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function syncThemeToggleButtons() {
    const isDark = getCurrentTheme() === 'dark';
    const icon = isDark ? 'fa-sun' : 'fa-moon';
    const label = isDark ? 'الوضع الفاتح' : 'الوضع المظلم';

    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        btn.innerHTML = `<i class="fas ${icon}"></i> ${label}`;
        btn.setAttribute('aria-label', `تغيير المظهر إلى ${label}`);
        btn.title = `تغيير المظهر إلى ${label}`;
    });
}

function bindThemeToggleButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        if (btn.dataset.themeBound === '1') return;
        btn.dataset.themeBound = '1';
        btn.addEventListener('click', toggleTheme);
    });
    syncThemeToggleButtons();
}

// Apply theme immediately to prevent flash
(function applyThemeImmediately() {
    setTheme(localStorage.getItem('theme') || 'light');
})();

window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        // Force a strict reload when returning from bfcache to prevent frozen/disabled states
        window.location.reload();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    bindThemeToggleButtons();
    
    // Fix Electron/Chromium focus bug where inputs become frozen after navigation
    setTimeout(() => {
        document.body.style.pointerEvents = 'auto'; // Force unlock pointer events
        document.documentElement.style.pointerEvents = 'auto'; // Double certainty
        
        // Remove any invisible overlay that might have been leftover
        const strayOverlays = document.querySelectorAll('.toast-container, .modal-backdrop, .overlay, .loading');
        strayOverlays.forEach(ol => {
            if (window.getComputedStyle(ol).display !== 'none' && !ol.hasChildNodes()) {
                 ol.style.display = 'none';
            }
        });
        
        // Do NOT force window.focus() or body.focus() to avoid interrupting user interactions immediately after load
    }, 50);

    // Failsafe: force clear any stuck mousedown state on mouse movement
    document.addEventListener('mousemove', (e) => {
        // If no buttons are pressed but Chromium thinks we're dragging, we can detect mismatched state
        if (e.buttons === 0) {
            document.body.classList.remove('mouse-drag-stuck');
        }
    }, { once: true });
});

window.toggleTheme = toggleTheme;
window.setTheme = setTheme;
window.getCurrentTheme = getCurrentTheme;
window.syncThemeToggleButtons = syncThemeToggleButtons;
window.bindThemeToggleButtons = bindThemeToggleButtons;
