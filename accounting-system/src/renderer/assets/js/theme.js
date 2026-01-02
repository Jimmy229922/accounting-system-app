// Theme Management
const themeToggleBtn = document.createElement('button');
themeToggleBtn.id = 'theme-toggle';
themeToggleBtn.className = 'theme-toggle-btn';
themeToggleBtn.innerHTML = '🌙'; // Default icon
themeToggleBtn.title = 'تغيير الوضع (داكن/فاتح)';

// Apply theme immediately to prevent flash
(function applyThemeImmediately() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    // document.documentElement.setAttribute('data-theme', savedTheme); // Already done
    updateIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateIcon(newTheme);
}

function updateIcon(theme) {
    themeToggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
}

themeToggleBtn.addEventListener('click', toggleTheme);

// Function to inject the button into the navbar
function injectThemeToggle() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks && !document.getElementById('theme-toggle')) {
        const li = document.createElement('li');
        li.appendChild(themeToggleBtn);
        // Append to the end of the list (which is visually the left side due to row-reverse)
        navLinks.appendChild(li);
    }
}

// Run on load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    // Try to inject immediately
    injectThemeToggle();
    
    // Also observe for navbar changes (in case it's rendered dynamically)
    const observer = new MutationObserver(() => {
        injectThemeToggle();
    });
    
    const app = document.getElementById('app');
    if (app) {
        observer.observe(app, { childList: true, subtree: true });
    }
});

// Expose for manual calling if needed
window.injectThemeToggle = injectThemeToggle;
