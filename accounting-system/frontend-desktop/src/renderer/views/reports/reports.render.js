(function () {
    function renderPage({ t, CUR }) {
        const app = document.getElementById('app');
        app.innerHTML = `
        ${buildTopNavHTML(t)}

        <main class="content reports-content">
            <div class="reports-page">
                <section class="reports-hero" style="background: var(--card-bg, var(--bg-color)); padding: 32px; border-radius: 20px; margin-bottom: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); border: 1px solid var(--border-color); position: relative; overflow: hidden;">
                    <div style="position: absolute; top: 0; right: 0; width: 100%; height: 6px; background: linear-gradient(90deg, var(--primary-color), var(--secondary-color, #1976d2));"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 24px; margin-bottom: 24px;">
                        <div class="reports-hero-main" style="display: flex; align-items: center; gap: 20px;">
                            <div class="page-hero-icon" style="background: rgba(var(--primary-rgb, 25, 118, 210), 0.1); color: var(--primary-color); width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border-radius: 16px; font-size: 1.8rem;"><i class="fas fa-chart-bar"></i></div>
                            <div>
                                <span class="hero-eyebrow" style="color: var(--primary-color); font-weight: bold; font-size: 0.9rem; letter-spacing: 0.5px; text-transform: uppercase;">${t('reports.hero.label', 'لوحة متابعة الفواتير')}</span>
                                <h1 style="margin: 5px 0; font-size: 2rem; color: var(--text-color);">${t('reports.title', 'التقارير العامة')}</h1>
                                <p style="margin: 0; color: var(--text-muted); font-size: 1rem;">${t('reports.subtitle', 'عرض وإدارة جميع فواتير المبيعات والمشتريات')}</p>
                            </div>
                        </div>

                        <div class="reports-tabs-nav" style="display: inline-flex; gap: 8px; background: rgba(0,0,0,0.03); padding: 6px; border-radius: 12px; border: 1px solid var(--border-color);">
                            <button class="reports-tab-btn active" data-target="general-reports" style="padding: 10px 24px; border: none; background: var(--primary-color); font-weight: 600; font-size: 0.95rem; border-radius: 8px; cursor: pointer; color: white; transition: all 0.3s ease; display: flex; align-items: center; gap: 8px;"><i class="fas fa-list"></i> التقارير العامة</button>
                            <button class="reports-tab-btn" data-target="profit-reports" style="padding: 10px 24px; border: none; background: transparent; font-weight: 600; font-size: 0.95rem; border-radius: 8px; cursor: pointer; color: var(--text-muted); transition: all 0.3s ease; display: flex; align-items: center; gap: 8px;"><i class="fas fa-chart-line"></i> أرباح المبيعات</button>
                        </div>
                    </div>

                    <div class="hero-stats" style="display: flex; gap: 16px; border-top: 1px solid var(--border-color); padding-top: 24px;">
                        <div class="hero-stat-card" style="display: flex; align-items: center; gap: 16px; padding-left: 32px; border-left: 1px solid var(--border-color);">
                            <div style="background: rgba(var(--primary-rgb, 25, 118, 210), 0.1); color: var(--primary-color); width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-size: 1.2rem;"><i class="fas fa-file-invoice"></i></div>
                            <div>
                                <span style="display: block; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 4px;">${t('reports.hero.currentResults', 'النتائج الحالية')}</span>
                                <strong id="heroResultCount" style="font-size: 1.5rem; color: var(--text-color);">0</strong>
                            </div>
                        </div>
                        <div class="hero-stat-card" style="display: flex; align-items: center; gap: 16px;">
                            <div style="background: rgba(var(--primary-rgb, 25, 118, 210), 0.1); color: var(--primary-color); width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-size: 1.2rem;"><i class="fas fa-sync-alt"></i></div>
                            <div>
                                <span style="display: block; color: var(--text-muted); font-size: 0.85rem; margin-bottom: 4px;">${t('reports.hero.lastRefresh', 'آخر تحديث')}</span>
                                <strong id="lastUpdatedLabel" style="font-size: 1.1rem; color: var(--text-color); direction: ltr; display: inline-block;">-</strong>
                            </div>
                        </div>
                    </div>
                </section>

                <div id="general-reports" class="reports-tab-content active" style="display: block;">

                <div id="reportsStatus" class="reports-status status-info">
                    ${t('reports.loading', 'جارٍ تحميل البيانات...')}
                </div>

                <section class="summary-strip" aria-label="${t('reports.summary.title', 'ملخص التقارير')}">
                    <article class="summary-card card-total">
                        <div class="sc-icon"><i class="fas fa-file-invoice"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.totalInvoices', 'إجمالي الفواتير')}</div>
                            <div class="sc-value" id="totalInvoices">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-sales">
                        <div class="sc-icon"><i class="fas fa-arrow-up"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.salesCount', 'فواتير المبيعات')}</div>
                            <div class="sc-value" id="salesCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-purchase">
                        <div class="sc-icon"><i class="fas fa-arrow-down"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.purchaseCount', 'فواتير المشتريات')}</div>
                            <div class="sc-value" id="purchaseCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-amount">
                        <div class="sc-icon"><i class="fas fa-coins"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.totalAmount', 'إجمالي المبالغ')}</div>
                            <div class="sc-value" id="totalAmount">0.00 ${CUR}</div>
                        </div>
                    </article>

                    <article class="summary-card card-sales-return">
                        <div class="sc-icon"><i class="fas fa-undo"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.salesReturnCount', 'مردودات المبيعات')}</div>
                            <div class="sc-value" id="salesReturnCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-purchase-return">
                        <div class="sc-icon"><i class="fas fa-undo"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.purchaseReturnCount', 'مردودات المشتريات')}</div>
                            <div class="sc-value" id="purchaseReturnCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-receipt">
                        <div class="sc-icon"><i class="fas fa-hand-holding-usd"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.receiptCount', 'سندات التحصيل')}</div>
                            <div class="sc-value" id="receiptCount">0</div>
                        </div>
                    </article>

                    <article class="summary-card card-payment">
                        <div class="sc-icon"><i class="fas fa-money-bill-wave"></i></div>
                        <div>
                            <div class="sc-label">${t('reports.summary.paymentCount', 'سندات السداد')}</div>
                            <div class="sc-value" id="paymentCount">0</div>
                        </div>
                    </article>
                </section>

                <section class="filters-panel">
                    <div class="filters-head">
                        <h2>${t('reports.filtersTitle', 'تصفية السجل')}</h2>
                        <p>${t('reports.filtersSubtitle', 'اختر نوع الفاتورة والعميل والفترة الزمنية ثم اضغط بحث.')}</p>
                    </div>

                    <div class="filters-grid">
                        <div class="form-group">
                            <label for="typeFilter"><i class="fas fa-filter"></i> ${t('reports.invoiceType', 'نوع الفاتورة')}</label>
                            <select id="typeFilter" class="form-control">
                                <option value="all">${t('reports.allTypes', 'الكل')}</option>
                                <option value="sales">${t('reports.salesType', 'مبيعات')}</option>
                                <option value="purchase">${t('reports.purchaseType', 'مشتريات')}</option>
                                <option value="sales_return">${t('reports.salesReturnType', 'مردودات مبيعات')}</option>
                                <option value="purchase_return">${t('reports.purchaseReturnType', 'مردودات مشتريات')}</option>
                                <option value="receipt">${t('reports.receiptType', 'سندات تحصيل')}</option>
                                <option value="payment">${t('reports.paymentType', 'سندات سداد')}</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="customerFilter"><i class="fas fa-user"></i> ${t('reports.customerSupplier', 'العميل / المورد')}</label>
                            <select id="customerFilter" class="form-control">
                                <option value="">${t('reports.allCustomers', 'الكل')}</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="startDate"><i class="fas fa-calendar-alt"></i> ${t('reports.fromDate', 'من تاريخ')}</label>
                            <input type="date" id="startDate" class="form-control">
                        </div>

                        <div class="form-group">
                            <label for="endDate"><i class="fas fa-calendar-alt"></i> ${t('reports.toDate', 'إلى تاريخ')}</label>
                            <input type="date" id="endDate" class="form-control">
                        </div>
                    </div>

                    <div class="filters-actions">
                        <button id="resetBtn" type="button" class="btn-secondary">
                            <i class="fas fa-undo"></i>
                            <span>${t('reports.resetFilters', 'إعادة ضبط')}</span>
                        </button>
                        <button id="searchBtn" type="button" class="btn-primary">
                            <i class="fas fa-search"></i>
                            <span>${t('reports.search', 'بحث')}</span>
                        </button>
                    </div>
                </section>

                <section class="table-card">
                    <div class="table-card-header">
                        <h3><i class="fas fa-list"></i> ${t('reports.tableTitle', 'سجل الفواتير')}</h3>
                        <div class="header-actions">
                            <span id="resultCount" class="result-count"></span>
                        </div>
                    </div>

                    <div class="table-wrap">
                        <table class="table reports-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>${t('reports.tableHeaders.date', 'التاريخ')}</th>
                                    <th>${t('reports.tableHeaders.invoiceNumber', 'رقم الفاتورة')}</th>
                                    <th>${t('reports.tableHeaders.type', 'النوع')}</th>
                                    <th>${t('reports.tableHeaders.customerSupplier', 'العميل / المورد')}</th>
                                    <th>${t('reports.tableHeaders.amount', 'المبلغ')}</th>
                                    <th>${t('reports.tableHeaders.actions', 'إجراءات')}</th>
                                </tr>
                            </thead>
                            <tbody id="reportsTableBody"></tbody>
                        </table>
                    </div>

                    <div id="paginationBar" class="pagination-bar" style="display: none;">
                        <div class="pagination-info" id="paginationInfo"></div>
                        <div class="pagination-btns" id="paginationBtns"></div>
                    </div>
                </section>
                </div>

                <div id="profit-reports" class="reports-tab-content" style="display: none;">
                    <div class="profit-hero" style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color, #1976d2)); border-radius: 12px; padding: 24px; color: white; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        <div style="display: flex; align-items: center; gap: 16px;">
                            <div style="background: rgba(255,255,255,0.2); padding: 16px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-chart-line" style="font-size: 2rem;"></i>
                            </div>
                            <div>
                                <h2 style="margin: 0; font-size: 1.5rem; font-weight: bold; color: white;">تفاصيل أرباح المبيعات</h2>
                                <p style="margin: 5px 0 0; opacity: 0.9; font-size: 0.95rem;">متابعة تفصيلية لأرباح الفواتير والأصناف بدقة</p>
                            </div>
                        </div>
                        <div style="text-align: left; background: rgba(255,255,255,0.1); padding: 16px 24px; border-radius: 12px; min-width: 200px;">
                             <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 5px;">إجمالي الأرباح للفترة المحددة</div>
                             <div id="profitTotalProfit" style="font-size: 2rem; font-weight: bold; color: white;">0.00 ${CUR}</div>
                        </div>
                    </div>

                    <section class="filters-panel" style="margin-bottom: 24px;">
                        <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end;">
                            <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom: 0;">
                                <label><i class="fas fa-user"></i> اسم العميل</label>
                                <select id="profitCustomerName" class="form-control">
                                    <option value="">الكل</option>
                                </select>
                            </div>
                            <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom: 0;">
                                <label><i class="fas fa-calendar-alt"></i> من تاريخ</label>
                                <input type="date" id="profitStartDate" class="form-control">
                            </div>
                            <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom: 0;">
                                <label><i class="fas fa-calendar-alt"></i> إلى تاريخ</label>
                                <input type="date" id="profitEndDate" class="form-control">
                            </div>
                            <div class="form-group" style="flex: 0 0 auto; margin-bottom: 0;">
                                <button id="searchProfitBtn" type="button" class="btn-primary" style="height: 42px; padding: 0 24px;">
                                    <i class="fas fa-search"></i>
                                    <span>بحث</span>
                                </button>
                            </div>
                        </div>
                    </section>

                    <section class="table-card">
                        <div class="table-card-header">
                            <h3><i class="fas fa-chart-line"></i> فواتير المبيعات</h3>
                        </div>
                        <div class="table-wrap">
                            <table class="table reports-table">
                                <thead>
                                    <tr>
                                        <th>رقم الفاتورة</th>
                                        <th>التاريخ</th>
                                        <th>العميل</th>
                                        <th>إجمالي الفاتورة</th>
                                        <th>التكلفة</th>
                                        <th>صافي الربح</th>
                                        <th>نسبة الربح</th>
                                        <th>إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody id="profitTableBody"></tbody>
                            </table>
                        </div>
                    </section>
                </div>

            </div>

            <div id="profitDetailsModal" class="voucher-modal-overlay" aria-hidden="true" style="display: none;">
                <div class="voucher-modal" style="max-width: 1100px; width: 95%; max-height: 90vh; overflow-y: auto; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                    <div class="voucher-modal-header">
                        <div class="voucher-modal-title-wrap">
                            <div class="voucher-modal-icon"><i class="fas fa-box-open"></i></div>
                            <div>
                                <h3>تفاصيل أرباح الأصناف</h3>
                                <p id="profitModalSubtitle">رقم الفاتورة: -</p>
                            </div>
                        </div>
                        <button type="button" class="voucher-modal-close" id="profitModalCloseBtn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="voucher-modal-content" style="padding: 20px;">
                        <table class="table reports-table">
                            <thead>
                                <tr>
                                    <th>الصنف</th>
                                    <th>الكمية</th>
                                    <th>التكلفة</th>
                                    <th>سعر البيع</th>
                                    <th>ربح الوحدة</th>
                                    <th>إجمالي الربح</th>
                                </tr>
                            </thead>
                            <tbody id="profitDetailsTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div id="voucherModal" class="voucher-modal-overlay" aria-hidden="true">
                <div class="voucher-modal" role="dialog" aria-modal="true" aria-labelledby="voucherModalTitle">
                    <div class="voucher-modal-header">
                        <div class="voucher-modal-title-wrap">
                            <div class="voucher-modal-icon"><i class="fas fa-receipt"></i></div>
                            <div>
                                <h3 id="voucherModalTitle">${t('reports.voucherPreviewTitle', 'عرض السند')}</h3>
                                <p id="voucherModalSubtitle">${t('reports.loading', 'جارٍ تحميل البيانات...')}</p>
                            </div>
                        </div>
                        <button type="button" class="voucher-modal-close" id="voucherModalCloseBtn" aria-label="${t('reports.close', 'إغلاق')}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="voucher-modal-content" id="voucherModalBody">
                        <div class="voucher-modal-loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>${t('reports.loading', 'جارٍ تحميل البيانات...')}</span>
                        </div>
                    </div>

                    <div class="voucher-modal-footer">
                        <button type="button" class="btn-primary" id="voucherModalPrintBtn">
                            <i class="fas fa-print"></i>
                            <span>${t('reports.printVoucher', 'طباعة السند')}</span>
                        </button>
                        <button type="button" class="btn-secondary" id="voucherModalCloseBtnFooter">
                            ${t('reports.close', 'إغلاق')}
                        </button>
                    </div>
                </div>
            </div>

        </main>
    `;
    }

    function buildTopNavHTML(t) {
        if (window.navManager && typeof window.navManager.getTopNavHTML === 'function') {
            return window.navManager.getTopNavHTML(t);
        }
        return '';
    }

    window.reportsPageRender = {
        renderPage
    };
})();
