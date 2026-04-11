(function () {
    function initializeTreasuryVoucherPage(config) {
        let ar = {};
        let allEntities = [];
        let selectedEntity = null;
        let recentTransactions = [];
        let entityAutocomplete = null;
        let suggestedVoucherNumber = '';

        const { t, fmt } = window.i18n?.createPageHelpers?.(() => ar) || { t: (k, f = '') => f, fmt: (t, v = {}) => String(t || '') };
        const tx = (suffix, fallback = '') => t(`${config.i18nPrefix}.${suffix}`, fallback);
        const text = (name) => {
            const entry = config.text?.[name];
            if (!entry) return '';
            return tx(entry.key, entry.fallback);
        };
        const renderer = window.createTreasuryPageRenderer
            ? window.createTreasuryPageRenderer({ config, t, tx, text })
            : null;

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

        function renderPage() {
            if (!renderer) return;
            renderer.renderPage();
        }

        function initializeElements() {
            document.getElementById('date').valueAsDate = new Date();
            generateVoucherNumber();
            document.getElementById(config.ids.form).addEventListener('submit', handleSubmit);
            document.getElementById('app').addEventListener('click', handleActionClick);
            document
                .getElementById(config.ids.entitySelect)
                .addEventListener('change', handleEntityChange);
            document.getElementById('amount').addEventListener('input', updatePreview);
            document.getElementById('voucherSearchBtn').addEventListener('click', searchVoucher);
        }

        function handleActionClick(event) {
            const actionEl = event.target.closest('[data-action]');
            if (!actionEl) return;

            const action = actionEl.dataset.action;
            if (action === 'quick-amount') {
                const amount = Number.parseFloat(actionEl.dataset.amount || '0');
                setQuickAmount(Number.isFinite(amount) ? amount : 0);
                return;
            }

            if (action === 'pay-full-balance') {
                payFullBalance();
                return;
            }

            if (action === 'close-voucher-search') {
                const resultContainer = document.getElementById('voucherSearchResult');
                if (resultContainer) {
                    resultContainer.style.display = 'none';
                }
            }
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
                const result = await window.electronAPI.getNextTreasuryVoucherNumber(config.transactionType);
                if (result?.success && result.voucher_number) {
                    suggestedVoucherNumber = result.voucher_number;
                    document.getElementById(config.ids.voucherInput).value = result.voucher_number;
                    return;
                }
                throw new Error(result?.error || 'Failed to get next voucher number');
            } catch (error) {
                const fallbackVoucher = `${config.numberPrefix}-${Date.now()}`;
                suggestedVoucherNumber = fallbackVoucher;
                document.getElementById(config.ids.voucherInput).value = fallbackVoucher;
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
            if (!renderer) return;
            renderer.renderEntityInfo(entity);
        }

        function renderEntityPlaceholder() {
            if (renderer) renderer.renderEntityPlaceholder();
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
            if (!renderer) return;
            renderer.renderRecentTransactions({ recentTransactions, allEntities });
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
            // document.getElementById('amount').focus();
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
                const voucherNumberForDescription =
                    suggestedVoucherNumber ||
                    document.getElementById(config.ids.voucherInput).value ||
                    `${config.numberPrefix}-${Date.now()}`;
                const data = {
                    type: config.transactionType,
                    date: document.getElementById('date').value,
                    customer_id: document.getElementById(config.ids.entitySelect).value,
                    amount: parseFloat(document.getElementById('amount').value),
                    description:
                        document.getElementById('description').value ||
                        fmt(text('defaultDescriptionTemplate'), { number: voucherNumberForDescription })
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
                    await generateVoucherNumber();
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
                    resultContainer.innerHTML = renderer
                        ? renderer.renderVoucherSearchResults(results)
                        : '';
                } else {
                    resultContainer.style.display = 'block';
                    resultContainer.innerHTML = renderer ? renderer.renderVoucherNoResults() : '';
                }
            } catch (err) {
                console.error(err);
            }
        }

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


