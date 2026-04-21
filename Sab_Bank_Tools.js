// ==UserScript==
// @name         SAB_Awwal_Smart_Panel
// @namespace    http://tampermonkey.net/
// @version      11.0
// @description  لوحة أدوات ساب الأول - نسخة مطورة
// @author       You
// @match        https://sabicorp.sab.com/Corporate/*
// @noframes
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const SIDEBAR_ID = 'sab-helper-sidebar';
    let antiLogoutInterval = null;

    // ---- جلب الـ iframe document ----
    const getIframeDoc = () => {
        const iframe = document.querySelector('iframe');
        if (!iframe) return null;
        try {
            return iframe.contentDocument || iframe.contentWindow?.document;
        } catch (e) { return null; }
    };

    // ---- جلب element من iframe أو document ----
    const getEl = (selector) => {
        return document.querySelector(selector)
        || getIframeDoc()?.querySelector(selector)
        || null;
    };

    // ---- جلب البيانات من الجداول ----
    const getDataByLabel = (labelText) => {
        const searchIn = (doc) => {
            const allRows = Array.from(doc.querySelectorAll('table tr'));
            const targetRow = allRows.find(row => {
                const label = row.querySelector('label.custLabel');
                return label && label.innerText.trim() === labelText;
            });
            if (!targetRow) return null;
            const cell = targetRow.querySelector('td:last-child');
            const numSpan = cell?.querySelector('.num');
            return numSpan ? numSpan.innerText.trim() : cell?.innerText.trim() ?? "";
        };

        let result = searchIn(document);
        if (result === null) {
            try { result = searchIn(getIframeDoc()); } catch (e) {}
        }
        return result ?? "";
    };

    // ---- دالة كتابة في input مع تفعيل events ----
    const fillInput = (el, value) => {
        if (!el) return false;
        el.removeAttribute('onpaste');
        el.setAttribute('type', 'text');
        const nativeSetter = Object.getOwnPropertyDescriptor(el.ownerDocument.defaultView.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(el, value); else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
    };

    // ---- اختيار من Chosen select ----
    const selectChosenOption = (doc, selectId, optionValue) => {
        const selectEl = doc?.querySelector(`#${selectId}`);
        if (!selectEl) return false;
        selectEl.value = optionValue;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        try {
            const iWin = getIframeDoc()?.defaultView;
            if (iWin?.$) iWin.$(`#${selectId}`).trigger('chosen:updated').trigger('change');
        } catch (e) {}
        return true;
    };

    // ---- توليد رقم فاتورة ----
    const generateInvoiceNumber = () => {
        const rnd = (len, pool) => Array.from({length: len}, () => pool[Math.floor(Math.random() * pool.length)]).join('');
        return `INV-${new Date().getFullYear()}-${rnd(2, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')}${rnd(2, '0123456789')}`;
    };

    // ---- flash ----
    const flashBtn = (btn, msg = 'تم ✅') => {
        const orig = btn.innerHTML;
        btn.classList.add('success');
        btn.innerHTML = `<span>${msg}</span>`;
        setTimeout(() => {
            btn.classList.remove('success');
            btn.innerHTML = orig;
        }, 2000);
    };

    // ---- بناء اللوحة ----
    const buildSidebar = () => {
        if (document.getElementById(SIDEBAR_ID)) return;

        // 1. الاستايل (تم تنظيفه ودمجه)
        if (!document.getElementById('sab-style')) {
            const style = document.createElement('style');
            style.id = 'sab-style';
            style.textContent = `
                #sab-helper-sidebar {
                    position: fixed;
                    right: 0;
                    top: 20%;
                    width: 230px;
                    background: #fff;
                    border: 2px solid #e11d1d;
                    border-right: none;
                    border-radius: 12px 0 0 12px;
                    z-index: 9999999;
                    box-shadow: -4px 0 16px rgba(0,0,0,0.18);
                    font-family: Arial, sans-serif;
                    direction: rtl;
                    transition: right 0.3s ease;
                }
                #sab-helper-sidebar.collapsed {
                    right: -230px;
                }
                #sab-toggle-tab {
                    position: absolute;
                    left: -42px; /* بروز من جهة اليسار */
                    top: 10px;
                    width: 40px;
                    height: 45px;
                    background: #e11d1d;
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border-radius: 10px 0 0 10px;
                    font-size: 20px;
                    box-shadow: -2px 0 8px rgba(0,0,0,0.1);
                }
                .sab-header { background: #e11d1d; color: #fff; padding: 11px 14px; font-weight: bold; font-size: 14px; border-radius: 10px 0 0 0; }
                .sab-divider { font-size: 10px; color: #aaa; padding: 6px 14px 2px; text-transform: uppercase; }
                .sab-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
                .tool-btn { background: #fafafa; border: 1px solid #e5e5e5; padding: 10px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: space-between; transition: 0.2s; color: #333; font-weight: 600; width: 100%; }
                .tool-btn:hover { background: #fff1f1; border-color: #e11d1d; transform: translateX(-4px); }
                .tool-btn.success { background: #28a745 !important; color: #fff !important; }
            `;
            document.head.appendChild(style);
        }

        const sidebar = document.createElement('div');
        sidebar.id = SIDEBAR_ID;

        // التحقق من حالة الإخفاء السابقة
        if (localStorage.getItem('sab_sidebar_collapsed') === 'true') {
            sidebar.classList.add('collapsed');
        }

        // زرار الإظهار والإخفاء (الترس)
        const toggleTab = document.createElement('div');
        toggleTab.id = 'sab-toggle-tab';
        toggleTab.innerHTML = sidebar.classList.contains('collapsed') ? '🛠️' : '❌';
        toggleTab.onclick = (e) => {
            sidebar.classList.toggle('collapsed');
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sab_sidebar_collapsed', isCollapsed);
            toggleTab.innerHTML = isCollapsed ? '🛠️' : '❌';
        };
        sidebar.appendChild(toggleTab);

        // محتوى اللوحة
        const content = document.createElement('div');
        content.innerHTML = `
            <div class="sab-header">🛠️ أدوات ساب الأول</div>
            <div class="sab-body" id="sab-body">
                <div class="sab-divider">الأدوات الأساسية</div>
            </div>
        `;
        sidebar.appendChild(content);
        document.body.appendChild(sidebar);

        const addBtn = (label, icon, onClick) => {
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            btn.innerHTML = `<span>${label}</span><span class="btn-icon">${icon}</span>`;
            btn.addEventListener('click', () => onClick(btn));
            document.getElementById('sab-body').appendChild(btn);
        };

        // --- الأزرار ---

        addBtn('نسخ وتحميل', '📥', (btn) => {
            const bName = getDataByLabel('Beneficiary Name');
            const amt = getDataByLabel('Transfer Amount');
            const acc = getDataByLabel('From Account Number');
            if (!bName || !amt) { alert('⚠️ بيانات ناقصة'); return; }
            const final = `${bName.split(/\s+/).slice(0, 2).join(' ')} $ ${amt.split('.')[0]} ${acc}`;
            GM_setClipboard(final);
            getEl('#payment_advice_download')?.click();
            flashBtn(btn, 'تم النسخ ✅');
        });

        addBtn('ملء البيانات', '⚡', (btn) => {
            const iDoc = getIframeDoc();
            const inv = generateInvoiceNumber();
            const accNo = iDoc?.querySelector('#beneficiaryAccNo');
            if (accNo) { accNo.removeAttribute('onpaste'); accNo.setAttribute('type', 'text'); }
            selectChosenOption(iDoc, 'purposeOfTransferCODE', 'OTHER_PURPOSE');
            setTimeout(() => {
                fillInput(iDoc?.querySelector('#otherPurposeOfTransfer'), 'PURCHASE OF GOODS');
                fillInput(iDoc?.querySelector('#forAccount'), 'PURCHASE OF GOODS');
                fillInput(iDoc?.querySelector('#forBeneficiary'), `INVOICE ${inv}`);
                flashBtn(btn);
            }, 800);
        });

        // ================================================================
        // الزر الثالث: التنشيط التلقائي (الضغط على زر الصفحة الرئيسية)
        // ================================================================

        const triggerClick = () => {
            // العنصر اللي إنت حددته بالظبط
            const target = getEl("#appwrapper > header > a");
            if (target) {
                console.log('SAB Tools: تم الضغط لتنشيط الجلسة ✅');
                target.click();
            } else {
                console.warn('SAB Tools: زر التنشيط غير موجود في هذه الصفحة');
            }
        };

        // فحص الحالة المخزنة
        let isActive = localStorage.getItem('sab_anti_logout') === 'true';

        // تشغيل التايمر تلقائياً لو كان "شغال" قبل كدة
        if (isActive && !antiLogoutInterval) {
            antiLogoutInterval = setInterval(triggerClick, 10000);
        }

        const btnLabel = isActive ? 'إيقاف التنشيط' : 'تنشيط (10 ثواني)';
        const btnIcon = isActive ? '🛑' : '🔄';

        addBtn(btnLabel, btnIcon, (btn) => {
            // قراءة الحالة الحالية من التخزين
            let currentlyActive = localStorage.getItem('sab_anti_logout') === 'true';

            if (currentlyActive) {
                // --- أمر الإيقاف ---
                localStorage.setItem('sab_anti_logout', 'false');
                if (antiLogoutInterval) {
                    clearInterval(antiLogoutInterval);
                    antiLogoutInterval = null;
                }
                // تحديث الزرار فوراً بدون ريفريش للصفحة
                btn.innerHTML = `<span>تنشيط (10 ثواني)</span><span class="btn-icon">🔄</span>`;
                flashBtn(btn, 'تم الإيقاف ⏹️');
            } else {
                // --- أمر التشغيل ---
                localStorage.setItem('sab_anti_logout', 'true');
                triggerClick(); // اضغط فوراً أول مرة
                antiLogoutInterval = setInterval(triggerClick, 10000);
                // تحديث الزرار فوراً
                btn.innerHTML = `<span>إيقاف التنشيط</span><span class="btn-icon">🛑</span>`;
                flashBtn(btn, 'بدء التنشيط ⚡');
            }
        });
    };

    // تشغيل وبناء
    buildSidebar();
    setInterval(() => {
        if (!document.getElementById(SIDEBAR_ID)) buildSidebar();
    }, 1000);

})();
