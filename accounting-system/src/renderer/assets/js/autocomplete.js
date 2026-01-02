class Autocomplete {
    constructor(selectElement) {
        this.selectElement = selectElement;
        this.options = [];
        this.selectedIndex = -1;
        
        this.init();
    }

    init() {
        // Hide original select
        this.selectElement.style.display = 'none';

        // Create wrapper
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'autocomplete-wrapper';
        this.selectElement.parentNode.insertBefore(this.wrapper, this.selectElement);
        this.wrapper.appendChild(this.selectElement);

        // Create input
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'autocomplete-input';
        this.input.placeholder = 'ابحث...';
        this.wrapper.appendChild(this.input);

        // Create list container
        this.list = document.createElement('div');
        this.list.className = 'autocomplete-list';
        this.wrapper.appendChild(this.list);

        // Event Listeners
        this.input.addEventListener('input', () => this.onInput());
        this.input.addEventListener('focus', () => this.onInput()); // Show list on focus
        this.input.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.closeList();
            }
        });

        // Initial sync
        this.syncOptions();

        // Sync disabled state and observe changes
        this.syncDisabledState();
        this.observeDisabledState();
    }

    syncDisabledState() {
        const disabled = this.selectElement.disabled || this.selectElement.hasAttribute('disabled');
        this.input.disabled = disabled;
        if (disabled) {
            this.input.setAttribute('disabled', 'true');
            this.closeList();
        } else {
            this.input.removeAttribute('disabled');
        }
    }

    observeDisabledState() {
        if (this._disabledObserver) return;
        this._disabledObserver = new MutationObserver(() => {
            this.syncDisabledState();
        });
        this._disabledObserver.observe(this.selectElement, { attributes: true, attributeFilter: ['disabled'] });
    }

    syncOptions() {
        this.options = Array.from(this.selectElement.options)
            .filter(opt => opt.value !== "") // Filter out placeholders
            .map(opt => ({
                value: opt.value,
                text: opt.text
            }));
        
        // If select has a value, set input text
        const selectedOption = this.options.find(o => o.value === this.selectElement.value);
        if (selectedOption && selectedOption.value) {
            this.input.value = selectedOption.text;
        }
    }

    onInput() {
        if (this.input.disabled) return;
        const value = this.input.value.toLowerCase();
        this.renderList(value);
    }

    renderList(filter = '') {
        this.list.innerHTML = '';
        let matches = this.options.filter(opt => opt.text.toLowerCase().includes(filter));
        
        // Always show all if filter is empty (on focus)
        if (filter === '') matches = this.options;

        if (matches.length === 0) {
            this.closeList();
            return;
        }

        matches.forEach((opt, index) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = opt.text;
            div.dataset.value = opt.value;
            
            div.addEventListener('click', () => {
                this.selectItem(opt);
            });

            this.list.appendChild(div);
        });

        this.list.classList.add('visible');
        this.selectedIndex = -1;
    }

    onKeyDown(e) {
        if (this.input.disabled) return;
        const items = this.list.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex++;
            if (this.selectedIndex >= items.length) this.selectedIndex = 0;
            this.highlightItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex--;
            if (this.selectedIndex < 0) this.selectedIndex = items.length - 1;
            this.highlightItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.selectedIndex > -1 && items[this.selectedIndex]) {
                items[this.selectedIndex].click();
            }
        } else if (e.key === 'Escape') {
            this.closeList();
        }
    }

    highlightItem(items) {
        items.forEach(item => item.classList.remove('selected'));
        if (items[this.selectedIndex]) {
            items[this.selectedIndex].classList.add('selected');
            items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    selectItem(option) {
        if (this.input.disabled) return;
        this.input.value = option.text;
        this.selectElement.value = option.value;
        
        // Trigger change event on original select so other scripts know
        const event = new Event('change');
        this.selectElement.dispatchEvent(event);
        
        this.closeList();
    }

    closeList() {
        this.list.classList.remove('visible');
        this.selectedIndex = -1;
    }
    
    // Method to refresh options if the underlying select changes
    refresh() {
        this.syncOptions();
        this.syncDisabledState();
    }
}
