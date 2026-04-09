(function () {
    function initializeTreasuryVoucherPage(config) {
        let ar = {};
        let allEntities = [];
        let selectedEntity = null;
        let recentTransactions = [];
        let entityAutocomplete = null;

        const pageI18n = window.i18n?.createPageHelpers ? window.i18n.createPageHelpers(() => ar) : null;
        const t = (key, fallback = '') => (pageI18n ? pageI18n.t(key, fallback) : fallback);
        const fmt = (template, values = {}) => (pageI18n ? pageI18n.fmt(template, values) : String(template || ''));
        const tx = (suffix, fallback = '') => t(`${config.i18nPrefix}.${suffix}`, fallback);
        const text = (name) => {
            const entry = config.text?.[name];
            if (!entry) return '';
            return tx(entry.key, entry.fallback);
        };

        function getViewVoucherRequest() {
            const params = new URLSearchParams(window.location.search);
            const viewId = (params.get('viewId') || '').trim();
            const voucher = (params.get('voucher') || '').trim();
            return { viewId, voucher };
        }

        async function handleVoucherViewRequest() {
            const { viewId, voucher } = getViewVoucherRequest();
            if (!viewId && !voucher) return;

            try {
                const transactions = await window.electronAPI.getTreasuryTransactions();
                let target = null;

                if (viewId) {
                    target = transactions.find(
                        (tr) => String(tr.id) === String(viewId) && tr.type === config.transactionType
                    );
                }

                if (!target && voucher) {
                    target = transactions.find(
                        (tr) =>
                            tr.type === config.transactionType &&
                            String(tr.voucher_number || '').trim() === voucher
                    );
                }

                if (!target) {
                    if (voucher) {
                        document.getElementById(config.ids.voucherInput).value = voucher;
                        await searchVoucher();
                    }
                    showToast(text('toastVoucherNotFound'), 'warning');
                    return;
                }

                if (target.transaction_date) {
                    document.getElementById('date').value = String(target.transaction_date).split('T')[0];
                }

                if (target.voucher_number) {
                    document.getElementById(config.ids.voucherInput).value = target.voucher_number;
                }

                if (target.customer_id) {
                    document.getElementById(config.ids.entitySelect).value = String(target.customer_id);
                    handleEntityChange();
                }

                document.getElementById('amount').value = Number(target.amount || 0).toFixed(2);
                document.getElementById('description').value = target.description || '';
                updatePreview();

                if (target.voucher_number) {
                    await searchVoucher();
                }

                showToast(text('toastLoadedFromReport'), 'success');
            } catch (error) {
                console.error(`Error loading ${config.pageId} voucher from report:`, error);
            }
        }

        function getNavHTML() {
            if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
                return window.navManager.getTopNavHTML(t);
            }
            return '';
        }

        function renderStatsCards() {
            return config.statsCards
                .map(
                    (card) => `
                        <div class="stat-card ${card.cardClass}">
                            <i class="fas ${card.icon}"></i>
                            <div class="stat-value" id="${card.valueId}">${card.initialValue}</div>
                            <div class="stat-label">${text(card.textName)}</div>
                        </div>
                    `
                )
                .join('');
        }
        function renderPage() {
            const app = document.getElementById('app');
            app.innerHTML = `
                ${getNavHTML()}

                <div class="content">
                    <div class="page-header receipt-header">
                        <div>
                            <h1 class="page-title ${config.visuals.titleClass}">
                                <i class="fas ${config.visuals.titleIcon}"></i>
                                ${text('pageTitle')}
                            </h1>
                            <p class="page-subtitle">${text('pageSubtitle')}</p>
                        </div>
                    </div>

                    <div class="stats-row">
                        ${renderStatsCards()}
                    </div>

                    <div class="receipt-layout">
                        <div class="form-card receipt-form-card">
                            <div class="card-header">
                                <i class="fas fa-file-invoice-dollar"></i>
                                <div>
                                    <h2>${text('formTitle')}</h2>
                                    <p class="card-subtitle">${text('formSubtitle')}</p>
                                </div>
                            </div>

                            <form id="${config.ids.form}" class="receipt-form">
                                <div class="receipt-form-layout">
                                    <div class="voucher-panel voucher-meta-panel">
                                        <div class="voucher-panel-head">
                                            <i class="fas fa-receipt"></i>
                                            <span>${text('voucherInfo')}</span>
                                        </div>
                                        <div class="compact-meta-grid">
                                            <div class="form-group compact-field">
                                                <label><i class="fas fa-calendar"></i> ${text('dateLabel')}</label>
                                                <input type="date" id="date" class="form-control" required>
                                            </div>
                                            <div class="form-group compact-field">
                                                <label><i class="fas fa-receipt"></i> ${text('numberLabel')}</label>
                                                <div class="voucher-search-wrapper">
                                                    <input type="text" id="${config.ids.voucherInput}" class="form-control" list="voucherSuggestions" placeholder="${text('autoPlaceholder')}" autocomplete="off">
                                                    <datalist id="voucherSuggestions"></datalist>
                                                    <button type="button" class="btn-voucher-search" id="voucherSearchBtn" title="${text('searchVoucher')}">
                                                        <i class="fas fa-search"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div id="voucherSearchResult" class="voucher-search-result" style="display:none;"></div>
                                    </div>

                                    <div class="voucher-panel voucher-details-panel">
                                        <div class="voucher-panel-head">
                                            <i class="fas fa-user-check"></i>
                                            <span>${text('detailsTitle')}</span>
                                        </div>
                                        <div class="details-grid">
                                            <div class="form-group">
                                                <label><i class="fas ${config.entity.icon}"></i> ${text('entityLabel')}</label>
                                                <div class="input-with-icon ${config.entity.fieldShellClass}">
                                                    <select id="${config.ids.entitySelect}" class="form-control" required>
                                                        <option value="">${text('searchPlaceholder')}</option>
                                                    </select>
                                                    <i class="fas ${config.entity.icon}"></i>
                                                </div>
                                            </div>

                                            <div class="form-group amount-block">
                                                <label><i class="fas fa-money-bill"></i> ${text('amountLabel')}</label>
                                                <div class="input-with-icon amount-field-shell">
                                                    <input type="number" id="amount" class="form-control amount-input ${config.visuals.amountInputClass}" step="0.01" min="0.01" placeholder="0.00" inputmode="decimal" required>
                                                    <i class="fas fa-pound-sign"></i>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="quick-actions receipt-quick-actions">
                                            <button type="button" class="quick-btn" onclick="setQuickAmount(100)"><i class="fas fa-plus"></i> 100</button>
                                            <button type="button" class="quick-btn" onclick="setQuickAmount(500)"><i class="fas fa-plus"></i> 500</button>
                                            <button type="button" class="quick-btn" onclick="setQuickAmount(1000)"><i class="fas fa-plus"></i> 1000</button>
                                            <button type="button" class="quick-btn" onclick="payFullBalance()"><i class="fas fa-check-double"></i> ${text('fullBalanceBtn')}</button>
                                        </div>

                                        <div class="receipt-balance-preview" id="${config.ids.balancePreview}">
                                            <div class="preview-item">
                                                <span class="preview-label">${text('currentBalanceLabel')}</span>
                                                <strong class="preview-value" id="previewCurrentBalance">-</strong>
                                            </div>
                                            <div class="preview-divider"></div>
                                            <div class="preview-item">
                                                <span class="preview-label">${text('afterBalanceLabel')}</span>
                                                <strong class="preview-value" id="previewAfterBalance">-</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label><i class="fas fa-sticky-note"></i> ${text('descriptionLabel')}</label>
                                    <textarea id="description" class="form-control" rows="3" placeholder="${text('descriptionPlaceholder')}"></textarea>
                                </div>

                                <button type="submit" class="btn-submit ${config.visuals.submitClass}" id="submitBtn">
                                    <i class="fas fa-save"></i>
                                    ${text('submitBtn')}
                                </button>
                            </form>
                        </div>

                        <div class="receipt-side-stack">
                            <div class="info-card receipt-info-card" id="${config.ids.entityCard}">
                                <div class="placeholder-card">
                                    <i class="fas ${config.entity.placeholderIcon}"></i>
                                    <p>${text('selectEntityPrompt')}</p>
                                </div>
                            </div>

                            <div class="info-card receipt-help-card">
                                <h3><i class="fas fa-lightbulb"></i> ${text('quickNotes')}</h3>
                                <ul>
                                    <li>${config.quickNote1(tx)}</li>
                                    <li>${text('quickNote2')}</li>
                                    <li>${text('quickNote3')}</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="recent-section">
                        <div class="section-header">
                            <i class="fas fa-history"></i>
                            <h3>${text('recentTransactionsTitle')}</h3>
                        </div>
                        <div class="transactions-list" id="recentTransactions">
                            <div class="no-transactions">
                                <i class="fas fa-inbox"></i>
                                <p>${text('noRecentTransactions')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        function initializeElements() {
            document.getElementById('date').valueAsDate = new Date();
            generateVoucherNumber();
            document.getElementById(config.ids.form).addEventListener('submit', handleSubmit);
            document
                .getElementById(config.ids.entitySelect)
                .addEventListener('change', handleEntityChange);
            document.getElementById('amount').addEventListener('input', updatePreview);
            document.getElementById('voucherSearchBtn').addEventListener('click', searchVoucher);
        }

        async function loadData() {
            try {
                const customers = await window.electronAPI.getCustomers();
                allEntities = customers.filter((entity) =>
                    config.entity.filterTypes.includes(entity.type)
                );

                const select = document.getElementById(config.ids.entitySelect);
                select.innerHTML = `<option value="">${text('searchPlaceholder')}</option>`;
                allEntities.forEach((entity) => {
                    const option = document.createElement('option');
                    option.value = entity.id;
                    option.textContent = `${entity.name} ${
                        entity.balance > 0
                            ? fmt(text('owedSuffix'), { amount: entity.balance.toFixed(2) })
                            : ''
                    }`;
                    select.appendChild(option);
                });

                const transactions = await window.electronAPI.getTreasuryTransactions();
                const datalist = document.getElementById('voucherSuggestions');
                datalist.innerHTML = '';
                const filteredTransactions = transactions
                    .filter((tr) => tr.type === config.transactionType && tr.voucher_number)
                    .slice(0, 20);
                filteredTransactions.forEach((tr) => {
                    const option = document.createElement('option');
                    option.value = tr.voucher_number;
                    datalist.appendChild(option);
                });

                if (entityAutocomplete) {
                    entityAutocomplete.refresh();
                } else {
                    entityAutocomplete = new Autocomplete(select);
                }

                recentTransactions = transactions
                    .filter((tr) => tr.type === config.transactionType && tr.customer_id)
                    .slice(0, 5);

                renderRecentTransactions();
                calculateStats();
            } catch (error) {
                console.error('Error loading data:', error);
                showToast(text('toastLoadError'), 'error');
            }
        }
        async function generateVoucherNumber() {
            try {
                const transactions = await window.electronAPI.getTreasuryTransactions();
                const count = transactions.filter((tr) => tr.type === config.transactionType).length;
                document.getElementById(
                    config.ids.voucherInput
                ).value = `${config.numberPrefix}-${String(count + 1).padStart(4, '0')}`;
            } catch (error) {
                document.getElementById(config.ids.voucherInput).value = `${config.numberPrefix}-${Date.now()}`;
            }
        }

        function handleEntityChange() {
            const entityId = document.getElementById(config.ids.entitySelect).value;
            if (!entityId) {
                renderEntityPlaceholder();
                updatePreview();
                return;
            }

            selectedEntity = allEntities.find((entity) => entity.id == entityId);
            if (selectedEntity) {
                renderEntityInfo(selectedEntity);
                updatePreview();
            }
        }

        function renderEntityInfo(entity) {
            const card = document.getElementById(config.ids.entityCard);
            const balanceClass = entity.balance > 0 ? 'positive' : entity.balance < 0 ? 'negative' : 'zero';
            const balanceHint =
                entity.balance > 0
                    ? text('balanceHintDebit')
                    : entity.balance < 0
                      ? text('balanceHintCredit')
                      : text('balanceHintZero');

            card.innerHTML = `
                <div class="entity-avatar ${config.entity.avatarClass}">
                    <i class="fas ${config.entity.icon}"></i>
                </div>
                <div class="entity-name">${entity.name}</div>
                <div class="entity-type">${text('entityType')}</div>
                ${
                    entity.phone || entity.address
                        ? `
                    <div class="entity-contact">
                        ${entity.phone ? `<span><i class="fas fa-phone"></i> ${entity.phone}</span>` : ''}
                        ${entity.address ? `<span><i class="fas fa-map-marker-alt"></i> ${entity.address}</span>` : ''}
                    </div>
                `
                        : ''
                }
                <div class="balance-display">
                    <div class="balance-label">${text('currentBalanceLabel')}</div>
                    <div class="balance-amount ${balanceClass}">${Math.abs(entity.balance).toFixed(2)} ج.م</div>
                    <div class="balance-hint">${balanceHint}</div>
                </div>
                <div class="entity-actions">
                    <a href="../../views/customer-reports/index.html?customerId=${entity.id}" class="btn-action primary">
                        <i class="fas fa-file-alt"></i>
                        ${text('accountStatement')}
                    </a>
                    <a href="${config.entity.newInvoicePath}" class="btn-action secondary">
                        <i class="fas ${config.entity.newInvoiceIcon}"></i>
                        ${text('newInvoiceAction')}
                    </a>
                </div>
            `;
        }

        function renderEntityPlaceholder() {
            const card = document.getElementById(config.ids.entityCard);
            card.innerHTML = `
                <div class="placeholder-card">
                    <i class="fas ${config.entity.placeholderIcon}"></i>
                    <p>${text('selectEntityPrompt')}</p>
                </div>
            `;
            selectedEntity = null;
            updatePreview();
        }

        function formatBalancePreview(balance) {
            if (balance > 0) {
                return `${balance.toFixed(2)} ${text('balanceOwed')}`;
            }
            if (balance < 0) {
                return `${Math.abs(balance).toFixed(2)} ${text('balanceCredit')}`;
            }
            return `0.00 ${text('balanceBalanced')}`;
        }

        function updatePreview() {
            const currentEl = document.getElementById('previewCurrentBalance');
            const afterEl = document.getElementById('previewAfterBalance');
            if (!currentEl || !afterEl) return;

            if (!selectedEntity) {
                currentEl.textContent = '-';
                afterEl.textContent = '-';
                return;
            }

            const currentBalance = Number(selectedEntity.balance) || 0;
            const amount = Number.parseFloat(document.getElementById('amount').value) || 0;
            const afterBalance = currentBalance - amount;

            currentEl.textContent = formatBalancePreview(currentBalance);
            afterEl.textContent = formatBalancePreview(afterBalance);
        }

        function renderRecentTransactions() {
            const container = document.getElementById('recentTransactions');

            if (recentTransactions.length === 0) {
                container.innerHTML = `
                    <div class="no-transactions">
                        <i class="fas fa-inbox"></i>
                        <p>${text('noRecentTransactions')}</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = recentTransactions
                .map((tr) => {
                    const entity = allEntities.find((item) => item.id == tr.customer_id);
                    return `
                        <div class="transaction-item">
                            <div class="transaction-info">
                                <div class="transaction-icon ${config.visuals.transactionClass}">
                                    <i class="fas ${config.visuals.transactionArrowIcon}"></i>
                                </div>
                                <div class="transaction-details">
                                    <h4>${entity?.name || text('unknownEntity')}</h4>
                                    <span>${tr.transaction_date} - ${tr.description || text('defaultDescription')}</span>
                                </div>
                            </div>
                            <div class="transaction-amount ${config.visuals.transactionClass}">${config.visuals.transactionAmountPrefix}${tr.amount.toFixed(2)}</div>
                        </div>
                    `;
                })
                .join('');
        }

        function calculateStats() {
            const today = new Date().toISOString().split('T')[0];

            const todayTotal = recentTransactions
                .filter((tr) => tr.transaction_date === today)
                .reduce((sum, tr) => sum + tr.amount, 0);
            document.getElementById(config.ids.todayStat).textContent = todayTotal.toFixed(2);

            const positiveBalanceEntities = allEntities.filter((entity) => entity.balance > 0);
            document.getElementById(config.ids.countStat).textContent = positiveBalanceEntities.length;

            const totalPositiveBalance = positiveBalanceEntities.reduce(
                (sum, entity) => sum + entity.balance,
                0
            );
            document.getElementById(config.ids.totalStat).textContent =
                totalPositiveBalance.toFixed(2);
        }

        function setQuickAmount(amount) {
            document.getElementById('amount').value = amount;
            document.getElementById('amount').focus();
            updatePreview();
        }

        function payFullBalance() {
            if (selectedEntity && selectedEntity.balance > 0) {
                document.getElementById('amount').value = selectedEntity.balance.toFixed(2);
                document.getElementById('description').value = text('fullBalanceDescription');
                updatePreview();
            } else {
                showToast(text('toastSelectEntityWithBalance'), 'warning');
            }
        }
        async function handleSubmit(e) {
            e.preventDefault();

            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text('toastSaving')}`;

            try {
                const voucherNumber = document.getElementById(config.ids.voucherInput).value;
                const data = {
                    type: config.transactionType,
                    date: document.getElementById('date').value,
                    customer_id: document.getElementById(config.ids.entitySelect).value,
                    amount: parseFloat(document.getElementById('amount').value),
                    voucher_number: voucherNumber,
                    description:
                        document.getElementById('description').value ||
                        fmt(text('defaultDescriptionTemplate'), { number: voucherNumber })
                };

                if (!data.customer_id || !data.amount || data.amount <= 0) {
                    showToast(text('toastFillRequired'), 'error');
                    return;
                }

                const result = await window.electronAPI.addTreasuryTransaction(data);

                if (result.success) {
                    showToast(text('toastSaveSuccess'), 'success');
                    document.getElementById(config.ids.form).reset();
                    document.getElementById('date').valueAsDate = new Date();
                    generateVoucherNumber();
                    renderEntityPlaceholder();
                    if (entityAutocomplete) entityAutocomplete.refresh();
                    loadData();
                } else {
                    showToast(fmt(text('toastSaveError'), { error: result.error }), 'error');
                }
            } catch (error) {
                console.error('Error:', error);
                showToast(text('toastUnexpectedError'), 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fas fa-save"></i> ${text('submitBtn')}`;
            }
        }

        function showToast(message, type = 'info') {
            if (typeof Toast !== 'undefined') {
                Toast.show(message, type);
            } else {
                alert(message);
            }
        }

        async function searchVoucher() {
            const voucherNumber = document.getElementById(config.ids.voucherInput).value.trim();
            const resultContainer = document.getElementById('voucherSearchResult');
            if (!voucherNumber) {
                resultContainer.style.display = 'none';
                return;
            }
            try {
                const res = await window.electronAPI.searchTreasuryByVoucher(voucherNumber);
                const results = Array.isArray(res?.results)
                    ? res.results.filter((tr) => tr.type === config.transactionType)
                    : [];

                if (res.success && results.length > 0) {
                    resultContainer.style.display = 'block';
                    resultContainer.innerHTML = `
                        <div class="voucher-result-header">
                            <i class="fas fa-file-alt"></i>
                            <span>${text('searchResults')} (${results.length})</span>
                            <button type="button" class="btn-close-search" onclick="document.getElementById('voucherSearchResult').style.display='none'">&times;</button>
                        </div>
                        ${results
                            .map(
                                (tr) => `
                            <div class="voucher-result-item">
                                <div class="voucher-result-row">
                                    <span class="voucher-result-label">${text('voucherNumberLabel')}:</span>
                                    <strong>${tr.voucher_number || '—'}</strong>
                                </div>
                                <div class="voucher-result-row">
                                    <span class="voucher-result-label">${text('dateLabel')}:</span>
                                    <span>${tr.transaction_date}</span>
                                </div>
                                <div class="voucher-result-row">
                                    <span class="voucher-result-label">${text('entityLabel')}:</span>
                                    <span>${tr.customer_name || '—'}</span>
                                </div>
                                <div class="voucher-result-row">
                                    <span class="voucher-result-label">${text('amountLabel')}:</span>
                                    <strong>${tr.amount.toFixed(2)} ج.م</strong>
                                </div>
                                <div class="voucher-result-row">
                                    <span class="voucher-result-label">${text('descriptionLabel')}:</span>
                                    <span>${tr.description || '—'}</span>
                                </div>
                            </div>
                        `
                            )
                            .join('')}
                    `;
                } else {
                    resultContainer.style.display = 'block';
                    resultContainer.innerHTML = `
                        <div class="voucher-result-header">
                            <i class="fas fa-search"></i>
                            <span>${text('noSearchResults')}</span>
                            <button type="button" class="btn-close-search" onclick="document.getElementById('voucherSearchResult').style.display='none'">&times;</button>
                        </div>
                    `;
                }
            } catch (err) {
                console.error(err);
            }
        }

        window.setQuickAmount = setQuickAmount;
        window.payFullBalance = payFullBalance;

        document.addEventListener('DOMContentLoaded', async () => {
            ar = (await window.i18n?.loadArabicDictionary?.()) || {};
            renderPage();
            initializeElements();
            await loadData();
            await handleVoucherViewRequest();
        });
    }

    window.initializeTreasuryVoucherPage = initializeTreasuryVoucherPage;
})();
