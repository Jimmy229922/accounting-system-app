(function () {
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async function loadAllItemDetails({ t, formatCurrency }) {
        const detailRows = document.querySelectorAll('.items-detail-row[data-loaded="false"]');
        const loadPromises = [];

        detailRows.forEach((row) => {
            const type = row.dataset.detailType;
            const id = Number.parseInt(row.dataset.detailId, 10);
            if (!type || !Number.isFinite(id)) return;

            const promise = window.electronAPI.getStatementItemDetails({ type, id }).then((result) => {
                if (!result || !result.success || !Array.isArray(result.details)) {
                    throw new Error('Failed to load customer statement item details');
                }

                if (result.details.length > 0) {
                    let html = `<td colspan="9"><div class="items-detail-box"><table class="items-inner-table"><thead><tr>
                    <th>#</th>
                    <th>${t('customerReports.itemHeaders.name', 'الصنف')}</th>
                    <th>${t('customerReports.itemHeaders.unit', 'الوحدة')}</th>
                    <th>${t('customerReports.itemHeaders.qty', 'الكمية')}</th>
                    <th>${t('customerReports.itemHeaders.price', 'السعر')}</th>
                    <th>${t('customerReports.itemHeaders.total', 'الإجمالي')}</th>
                    </tr></thead><tbody>`;
                    result.details.forEach((itm, i) => {
                        html += `<tr><td>${i + 1}</td><td>${escapeHtml(itm.item_name)}</td><td>${escapeHtml(itm.unit_name || '—')}</td><td>${itm.quantity}</td><td>${formatCurrency(itm.price || 0)}</td><td>${formatCurrency(itm.total_price || 0)}</td></tr>`;
                    });
                    html += `</tbody></table></div></td>`;
                    row.innerHTML = html;
                } else {
                    row.innerHTML = `<td colspan="9"><div class="items-loading">${t('customerReports.noItems', 'لا توجد أصناف')}</div></td>`;
                }
                row.dataset.loaded = 'true';
            });

            loadPromises.push(promise);
        });

        await Promise.all(loadPromises);
    }

    window.customerReportsUtils = {
        loadAllItemDetails
    };
})();
