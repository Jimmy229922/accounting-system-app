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

document.addEventListener('DOMContentLoaded', () => {
    bindThemeToggleButtons();
});

window.toggleTheme = toggleTheme;
window.setTheme = setTheme;
window.getCurrentTheme = getCurrentTheme;
window.syncThemeToggleButtons = syncThemeToggleButtons;
window.bindThemeToggleButtons = bindThemeToggleButtons;
