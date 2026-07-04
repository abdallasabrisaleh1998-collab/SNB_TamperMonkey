// SAB EL AWL SMART PANEL
(function() {
    'use strict';

    if (window.__SAB_PANEL__) {
        console.log("⛔ Panel already running");
        return;
    }
    window.__SAB_PANEL__ = true;

    const SIDEBAR_ID = 'sab-helper-sidebar';
    let antiLogoutInterval = null;

    const getIframeDoc = () => {
        const iframe = document.querySelector('iframe');
        if (!iframe) return null;
        try {
            return iframe.contentDocument || iframe.contentWindow?.document;
        } catch (e) { return null; }
    };

    const getEl = (selector) => {
        return document.querySelector(selector)
            || getIframeDoc()?.querySelector(selector)
            || null;
    };

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

    const generateInvoiceNumber = () => {
        const rnd = (len, pool) => Array.from({length: len}, () => pool[Math.floor(Math.random() * pool.length)]).join('');
        return `INV-${new Date().getFullYear()}-${rnd(2, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')}${rnd(2, '0123456789')}`;
    };

    const flashBtn = (btn, msg = 'تم ✅') => {
        const orig = btn.innerHTML;
        btn.classList.add('success');
        btn.innerHTML = `<span>${msg}</span>`;
        setTimeout(() => {
            btn.classList.remove('success');
            btn.innerHTML = orig;
        }, 2000);
    };

    const copyText = (text) => {
        const tmp = document.createElement('textarea');
        tmp.value = text;
        tmp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(tmp);
        tmp.focus();
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
    };

    const buildSidebar = () => {
        if (document.getElementById(SIDEBAR_ID)) return;

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
                    font-family: Cairo, Arial, sans-serif;
                    direction: rtl;
                    transition: right 0.3s ease;
                }
                #sab-helper-sidebar.collapsed { right: -230px; }
                #sab-toggle-tab {
                    position: absolute;
                    left: -42px;
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

        if (localStorage.getItem('sab_sidebar_collapsed') === 'true') {
            sidebar.classList.add('collapsed');
        }

        const toggleTab = document.createElement('div');
        toggleTab.id = 'sab-toggle-tab';
        toggleTab.innerHTML = sidebar.classList.contains('collapsed') ? '🛠️' : '❌';
        toggleTab.onclick = () => {
            sidebar.classList.toggle('collapsed');
            const isCollapsed = sidebar.classList.contains('collapsed');
            localStorage.setItem('sab_sidebar_collapsed', isCollapsed);
            toggleTab.innerHTML = isCollapsed ? '🛠️' : '❌';
        };
        sidebar.appendChild(toggleTab);

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
        
        // ================================================================
        // الزر الأول: نسخ وتحميل (التحميل المبدئي)
        // ================================================================
        addBtn('نسخ وتحميل المبدأي', '📥', (btn) => {
            const bNameRaw = getDataByLabel('Beneficiary Name');
            const amtRaw = getDataByLabel('Transfer Amount');
            
            if (!bNameRaw || !amtRaw) { 
                alert('⚠️ بيانات ناقصة، تأكد أنك في صفحة تفاصيل الحوالة المبدئية'); 
                return; 
            }
        
            // 1. استخراج أول كلمتين من اسم المستفيد
            const beneficiaryName = bNameRaw.split(/\s+/).slice(0, 2).join(' ');
        
            // 2. تعديل تنسيق المبلغ
            let transferAmt = amtRaw;
            const amtParts = amtRaw.split(/\s+/);
            if (amtParts.length >= 2) {
                transferAmt = `${amtParts[1]} ${amtParts[0]}`;
            } else {
                transferAmt = `${amtRaw} USD`;
            }
        
            // 3. جلب اسم الشركة من جوه الـ iframe
            const iframeDoc = document.getElementById('icanvas')?.contentDocument;
            const corpElement = iframeDoc?.querySelector(".panel-body table tbody tr:nth-child(2) td:nth-child(2)");
            
            let corpName = "";
            if (corpElement) {
                const textFound = (corpElement.innerText || corpElement.textContent || "").trim();
                if (textFound !== "") {
                    corpName = textFound.split(/\s+/).slice(0, 2).join(' ');
                }
            }
        
            if (!corpName) {
                alert("⚠️ لم يتمكن الكود من العثور على اسم الحساب!");
                return;
            }
        
            // 4. تكوين الاسم النهائي
            const finalName = `INT - TRF - ${beneficiaryName} - ${transferAmt} - ${corpName} - SABB`;
        
            // 5. نسخ وتحميل
            copyText(finalName);
            getEl('#payment_advice_download')?.click();
            flashBtn(btn, 'تم النسخ والمبدأي ✅');
        });
                
        // ================================================================
        // التحميل النهائي (SWIFT MT103)
        // ================================================================
        addBtn('تحميل النهائي MT103', '⚙️', async (btn) => {
            try {
                // 1. الانتقال إلى صفحة التقارير عبر القائمة الجانبية
                const navLink = document.querySelector("#appwrapper > div.bodywrapper > div.contentwrap > aside > nav > ul > li:nth-child(9) > a");
                if (!navLink) { alert('⚠️ لم يتم العثور على رابط القائمة الجانبية'); return; }
                navLink.click();

                // دالة انتظار مخصصة مبنية على الـ getEl الخاص بالاسكربت
                const waitForElement = (selector, timeout = 10000) => {
                    return new Promise((resolve, reject) => {
                        const startTime = Date.now();
                        const interval = setInterval(() => {
                            const el = getEl(selector);
                            if (el && el.offsetHeight > 0) {
                                clearInterval(interval);
                                resolve(el);
                            } else if (Date.now() - startTime > timeout) {
                                clearInterval(interval);
                                reject(new Error(`Timeout waiting for: ${selector}`));
                            }
                        }, 300);
                    });
                };

                // 2. انتظار ظهور الجدول الرئيسي
                await waitForElement("#data");

                // 3. الضغط على أول رابط حوالة متاح في الجدول
                const firstRowLink = getEl("#data > tbody > tr:nth-child(1) > td.sorting_1 > u > a") || getEl("#data tbody tr:first-child a");
                if (!firstRowLink) throw new Error("لم يتم العثور على رابط أول حوالة");
                firstRowLink.click();

                // 4. انتظار ظهور الموديل الخاص بتفاصيل الحوالة
                await waitForElement("#print-me");

                // دالة داخلية لاستخراج بيانات الموديل بالاعتماد على اسم الحقل (Label) لتفادي تغير الترتيب
                const getModalDataByLabel = (labelName) => {
                    const modal = getEl("#print-me");
                    if (!modal) return "";
                    const rows = modal.querySelectorAll("table tbody tr");
                    for (let row of rows) {
                        const cells = row.querySelectorAll("td");
                        if (cells.length >= 2) {
                            if (cells[0].textContent.trim().includes(labelName)) {
                                return cells[1].textContent.trim();
                            }
                        }
                    }
                    return "";
                };

                // 5. استخراج النصوص المطلوبة ديناميكياً
                const corpNameRaw = getModalDataByLabel('Corporate ID');
                const transferAmtRaw = getModalDataByLabel('Transfer Amount');
                const beneficiaryNameRaw = getModalDataByLabel('Beneficiary Name');

                if (!corpNameRaw || !transferAmtRaw || !beneficiaryNameRaw) {
                    alert('⚠️ بيانات تفاصيل الحوالة ناقصة أو لم تظهر بشكل صحيح');
                    return;
                }

                // معالجة الكلمات لتطابق الصيغة المطلوبة
                const corpName = corpNameRaw.split(/\s+/).slice(0, 2).join(' ');
                const beneficiaryName = beneficiaryNameRaw.split(/\s+/).slice(0, 2).join(' ');
                
                let transferAmt = transferAmtRaw;
                const amtParts = transferAmtRaw.split(/\s+/);
                if (amtParts.length >= 2) {
                    transferAmt = `${amtParts[1]} ${amtParts[0]}`; // تحويل الصيغة إلى 17,375.00 USD
                }

                // 6. تركيب الاسم النهائي ونسخه للحافظة
                const finalName = `MT103 - SWIFT - ${beneficiaryName} - ${transferAmt} - ${corpName} - SABB`;
                copyText(finalName);

                // 7. الضغط على زر تحميل SWIFT (حل مشكلة الـ ID المتغير عن طريق صيغة الـ onclick الثابتة)
                const modal = getEl("#print-me");
                const downloadBtn = modal?.querySelector("a[onclick*='downloadSwiftCopy']");

                if (downloadBtn) {
                    downloadBtn.click();
                    flashBtn(btn, 'تم النسخ والتحميل 🚀');
                } else {
                    alert('⚠️ لم يتم العثور على زر تحميل SWIFT Copy داخل تفاصيل الحوالة');
                }

            } catch (error) {
                console.error(error);
                alert('❌ خطأ: ' + error.message);
            }
        });
        
        // ================================================================
        // الزر الثاني: ملء البيانات
        // ================================================================
        addBtn('ملء البيانات', '⚡', (btn) => {
            const iDoc = getIframeDoc();
            const inv = generateInvoiceNumber();
            
            const accNo = iDoc?.querySelector('#beneficiaryAccNo');
            if (accNo) { accNo.removeAttribute('onpaste'); accNo.setAttribute('type', 'text'); }
            
            // ← السطر الجديد لخانة التأكيد
            const confirmAccNo = iDoc?.querySelector('#confimrbeneficiaryAccNo');
            if (confirmAccNo) { confirmAccNo.removeAttribute('onpaste'); confirmAccNo.setAttribute('type', 'text'); }
        
            selectChosenOption(iDoc, 'purposeOfTransferCODE', 'OTHER_PURPOSE');
            setTimeout(() => {
                fillInput(iDoc?.querySelector('#otherPurposeOfTransfer'), 'PURCHASE OF GOODS');
                fillInput(iDoc?.querySelector('#forAccount'), 'PURCHASE OF GOODS');
                fillInput(iDoc?.querySelector('#forBeneficiary'), `INVOICE ${inv}`);
                flashBtn(btn);
            }, 800);
        });

        // ================================================================
        // الزر الثالث: التنشيط التلقائي
        // ================================================================
        const triggerClick = () => {
            const target = getEl("#appwrapper > header > a");
            if (target) {
                console.log('SAB Tools: تم الضغط لتنشيط الجلسة ✅');
                target.click();
            } else {
                console.warn('SAB Tools: زر التنشيط غير موجود في هذه الصفحة');
            }
        };

        let isActive = localStorage.getItem('sab_anti_logout') === 'true';
        if (isActive && !antiLogoutInterval) {
            antiLogoutInterval = setInterval(triggerClick, 10000);
        }

        addBtn(isActive ? 'إيقاف التنشيط' : 'تنشيط (10 ثواني)', isActive ? '🛑' : '🔄', (btn) => {
            let currentlyActive = localStorage.getItem('sab_anti_logout') === 'true';
            if (currentlyActive) {
                localStorage.setItem('sab_anti_logout', 'false');
                if (antiLogoutInterval) { clearInterval(antiLogoutInterval); antiLogoutInterval = null; }
                btn.innerHTML = `<span>تنشيط (10 ثواني)</span><span class="btn-icon">🔄</span>`;
                flashBtn(btn, 'تم الإيقاف ⏹️');
            } else {
                localStorage.setItem('sab_anti_logout', 'true');
                triggerClick();
                antiLogoutInterval = setInterval(triggerClick, 10000);
                btn.innerHTML = `<span>إيقاف التنشيط</span><span class="btn-icon">🛑</span>`;
                flashBtn(btn, 'بدء التنشيط ⚡');
            }
        });

        // ================================================================
        // الزر الرابع: تقسيم العنوان
        // ================================================================
        const dividerSection = document.createElement('div');
        dividerSection.style.cssText = 'padding: 6px 8px; display: flex; flex-direction: column; gap: 6px;';
        dividerSection.innerHTML = `
            <div class="sab-divider">تقسيم العنوان</div>
            <textarea id="sab-address-input" placeholder="اكتب العنوان هنا..."
                style="width:100%; padding:8px; border:1px solid #e5e5e5; border-radius:8px;
                       font-size:12px; resize:none; height:60px; direction:ltr; box-sizing:border-box;
                       font-family:Arial; outline:none;"></textarea>
            <button id="sab-split-btn" class="tool-btn">
                <span>تقسيم العنوان</span><span>✂️</span>
            </button>
            <div id="sab-split-result" style="display:flex; flex-direction:column; gap:5px;"></div>
        `;
        document.getElementById('sab-body').appendChild(dividerSection);

        // دالة بتدور على عنصر بالـ selector في الصفحة الرئيسية، ولو مالقتوش
        // بتدور جوه كل الـ iframes الموجودة (زي iframe#icanvas) بشكل recursive
        function findElementDeep(selector, rootDoc) {
            rootDoc = rootDoc || document;

            // 1) دور في الدوكيومنت الحالي
            let el = rootDoc.querySelector(selector);
            if (el) return el;

            // 2) دور جوه كل الـ iframes في الدوكيومنت ده
            const iframes = rootDoc.querySelectorAll('iframe');
            for (const frame of iframes) {
                try {
                    const innerDoc = frame.contentDocument || frame.contentWindow?.document;
                    if (!innerDoc) continue;

                    el = innerDoc.querySelector(selector);
                    if (el) return el;

                    // لو فيه iframe جوه iframe (تداخل)
                    const nested = findElementDeep(selector, innerDoc);
                    if (nested) return nested;
                } catch (e) {
                    // cross-origin أو أي مشكلة وصول - تجاهل واستمر
                    continue;
                }
            }

            return null;
        }

        // دالة تحديث حقل الإنبت وتشغيل الإيفنتات بتاعته (عشان أي فريمورك زي React/Vue يحس بالتغيير)
        function setInputValue(el, value) {
            const proto = Object.getPrototypeOf(el);
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) {
                setter.call(el, value);
            } else {
                el.value = value;
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }

        document.getElementById('sab-split-btn').addEventListener('click', () => {
            const raw = document.getElementById('sab-address-input').value.trim();
            if (!raw) { alert('⚠️ اكتب العنوان الأول'); return; }
        
            const words = raw.split(/\s+/);
            const lines = [];
            let current = '';
        
            for (const word of words) {
                const test = current ? `${current} ${word}` : word;
                if (lines.length < 1) {
                    // السطر الأول: احترم الـ 35
                    if (test.length <= 35) {
                        current = test;
                    } else {
                        lines.push(current);
                        current = word.slice(0, 35);
                    }
                } else {
                    // السطر التاني: كمّل الكلمات طول ما في مساحة
                    if (test.length <= 35) {
                        current = test;
                    } else {
                        break; // امتلأ السطر التاني
                    }
                }
            }
            if (current) lines.push(current.slice(0, 35));
        
            const resultDiv = document.getElementById('sab-split-result');
            resultDiv.innerHTML = '';
        
            lines.forEach((line, i) => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex; align-items:center; gap:5px;';
                row.innerHTML = `
                    <div style="flex:1; background:#f5f5f5; border:1px solid #ddd; border-radius:6px;
                                padding:6px 8px; font-size:11px; direction:ltr; font-family:Arial;
                                white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
                         title="${line}">${line}</div>
                    <button class="sab-copy-line" data-val="${line}"
                        style="background:#e11d1d; color:#fff; border:none; border-radius:6px;
                               padding:6px 10px; cursor:pointer; font-size:11px; white-space:nowrap;">
                        نسخ ${i + 1}
                    </button>
                `;
                resultDiv.appendChild(row);
            });
        
            resultDiv.querySelectorAll('.sab-copy-line').forEach(btn => {
                btn.addEventListener('click', () => {
                    copyText(btn.getAttribute('data-val'));
                    const orig = btn.innerHTML;
                    btn.innerHTML = '✅';
                    btn.style.background = '#28a745';
                    setTimeout(() => { btn.innerHTML = orig; btn.style.background = '#e11d1d'; }, 1500);
                });
            });

            // تخزين آخر نتيجة تقسيم عشان زرار الإدخال يستخدمها
            dividerSection._lastLines = lines;
        });

        // ================================================================
        // الزر الجديد: إدخال ال 2 صفوف مباشرة في الحقول
        // ================================================================
        const insertRow = document.createElement('div');
        insertRow.style.cssText = 'display:flex; flex-direction:column; gap:5px;';
        insertRow.innerHTML = `
            <button id="sab-insert-btn" class="tool-btn">
                <span>ادخال ال 2 صفوف</span><span>📥</span>
            </button>
        `;
        dividerSection.appendChild(insertRow);

        document.getElementById('sab-insert-btn').addEventListener('click', () => {
            const lines = dividerSection._lastLines;
            if (!lines || lines.length === 0) {
                alert('⚠️ اعمل تقسيم العنوان الأول');
                return;
            }

            const field1 = findElementDeep('#beneAddress1');
            const field2 = findElementDeep('#beneAddress2');

            if (!field1 || !field2) {
                alert('⚠️ مفيش حقول beneAddress1 / beneAddress2 (دورت في الصفحة وجوه الـ iframe)');
                return;
            }

            setInputValue(field1, lines[0] || '');
            setInputValue(field2, lines[1] || '');

            const btn = document.getElementById('sab-insert-btn');
            const orig = btn.innerHTML;
            btn.innerHTML = '<span>تم الإدخال ✅</span>';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        });

        // ================================================================
        // مراقبة زرار الـ Submit المحدد: تنبيه لو العملة مش USD
        // ================================================================

        // دالة بتقيّم XPath على دوكيومنت معين وترجع أول عنصر متطابق
        function evaluateXPath(xpath, doc) {
            try {
                const result = doc.evaluate(
                    xpath, doc, null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE, null
                );
                return result.singleNodeValue;
            } catch (e) {
                return null;
            }
        }

        // دالة بتدور على عنصر بالـ XPath في الصفحة الرئيسية، ولو مالقتوش
        // بتدور جوه كل الـ iframes (زي icanvas) بشكل recursive
        function findElementByXPathDeep(xpath, rootDoc) {
            rootDoc = rootDoc || document;

            let el = evaluateXPath(xpath, rootDoc);
            if (el) return el;

            const iframes = rootDoc.querySelectorAll('iframe');
            for (const frame of iframes) {
                try {
                    const innerDoc = frame.contentDocument || frame.contentWindow?.document;
                    if (!innerDoc) continue;

                    el = evaluateXPath(xpath, innerDoc);
                    if (el) return el;

                    const nested = findElementByXPathDeep(xpath, innerDoc);
                    if (nested) return nested;
                } catch (e) {
                    continue;
                }
            }

            return null;
        }

        // ديف التنبيه بتاع العملة (بيتبني جوه نفس الدوكيومنت بتاع الزرار عشان يظهر صح جوه الـ iframe)
        function showCurrencyWarning(ownerDoc, currencyCode, onDecision) {
            // منع تكرار الديف لو فاتح قبل كده
            const existing = ownerDoc.getElementById('sab-currency-warning-overlay');
            if (existing) existing.remove();

            const overlay = ownerDoc.createElement('div');
            overlay.id = 'sab-currency-warning-overlay';
            overlay.style.cssText = `
                position:fixed; top:0; left:0; width:100%; height:100%;
                background:rgba(0,0,0,0.5); z-index:999999;
                display:flex; align-items:center; justify-content:center;
                font-family:Arial;
            `;

            overlay.innerHTML = `
                <div style="background:#fff; border-radius:10px; padding:20px; max-width:380px;
                            width:90%; text-align:center; direction:rtl; box-shadow:0 4px 20px rgba(0,0,0,0.3);">
                    <div style="font-size:32px; margin-bottom:10px;">⚠️</div>
                    <h3 style="margin:0 0 10px 0; font-size:16px; color:#333;">
                        العملة المختارة مش دولار
                    </h3>
                    <p style="font-size:13px; color:#555; margin-bottom:20px;">
                        إنت مختار عملة <b>${currencyCode}</b> بدل الدولار (USD).
                        <br>هل تحب تكمل بنفس العملة دي، ولا ترجع تغيّرها؟
                    </p>
                    <div style="display:flex; gap:10px;">
                        <button id="sab-currency-cancel-btn"
                            style="flex:1; padding:10px; border:1px solid #ccc; background:#f5f5f5;
                                   border-radius:8px; cursor:pointer; font-size:13px;">
                            رجوع لتغيير العملة
                        </button>
                        <button id="sab-currency-continue-btn"
                            style="flex:1; padding:10px; border:none; background:#e11d1d; color:#fff;
                                   border-radius:8px; cursor:pointer; font-size:13px;">
                            متابعة
                        </button>
                    </div>
                </div>
            `;

            ownerDoc.body.appendChild(overlay);

            ownerDoc.getElementById('sab-currency-continue-btn').addEventListener('click', () => {
                overlay.remove();
                onDecision(true);
            });

            ownerDoc.getElementById('sab-currency-cancel-btn').addEventListener('click', () => {
                overlay.remove();
                onDecision(false);
            });
        }

        // XPath الخاص بزرار الـ Submit المطلوب مراقبته فقط (احتياطي لو الـ ID اتغير يومًا ما)
        const submitBtnXPath = '/html/body/section/div[1]/div/div/div/form/div/div[1]/div[4]/div/div[3]/button[2]';

        // بنحاول نلاقي الزرار كذا مرة (polling) لحد ما الـ iframe يحمل محتواه فعليًا
        let submitBtnAttempts = 0;
        const submitBtnMaxAttempts = 40; // 40 محاولة * 300ms = 12 ثانية تقريبًا
        const submitBtnInterval = setInterval(() => {
            submitBtnAttempts++;

            // أولوية للبحث بالـ ID، ولو مالقهوش نجرب الـ XPath
            let submitBtn = findElementDeep('#btn-click');
            if (!submitBtn) {
                submitBtn = findElementByXPathDeep(submitBtnXPath);
            }

            if (submitBtn) {
                clearInterval(submitBtnInterval);
                attachCurrencyCheckToButton(submitBtn);
            } else if (submitBtnAttempts >= submitBtnMaxAttempts) {
                clearInterval(submitBtnInterval);
                console.warn('sab-tool: مالقتش زرار #btn-click بعد', submitBtnMaxAttempts, 'محاولة');
            }
        }, 300);

        function attachCurrencyCheckToButton(submitBtn) {
            // منع ربط نفس الحدث أكتر من مرة على نفس الزرار
            if (submitBtn.dataset.sabCurrencyCheckAttached === '1') return;
            submitBtn.dataset.sabCurrencyCheckAttached = '1';

            let bypassCurrencyCheck = false;

            submitBtn.addEventListener('click', function (e) {
                // لو ده كليك مبرمج بعد موافقة المستخدم، سيبه يكمل عادي من غير أي فحص
                if (bypassCurrencyCheck) {
                    bypassCurrencyCheck = false;
                    return;
                }

                const ownerDoc = submitBtn.ownerDocument;
                const currencySelect = ownerDoc.getElementById('currencyCODE');
                const currencyVal = currencySelect ? currencySelect.value : '';

                // لو العملة فاضية أو USD، سيب الكليك يكمل عادي (من غير تدخل)
                if (!currencyVal || currencyVal === 'USD') {
                    return;
                }

                // وقف الكليك الأصلي تمامًا لحد ما المستخدم يقرر
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                showCurrencyWarning(ownerDoc, currencyVal, (userWantsToContinue) => {
                    if (userWantsToContinue) {
                        bypassCurrencyCheck = true;
                        submitBtn.click(); // يعيد نفس الكليك، وهيتجاهل الفحص لأن bypassCurrencyCheck = true
                    }
                    // لو اختار "رجوع"، مفيش حاجة تحصل، الصفحة تفضل زي ما هي عشان يغير العملة
                });
            }, true); // true = capture phase، عشان نمسك الكليك قبل أي هاندلر تاني على نفس الزرار
        }
    };

        
    buildSidebar();
    if (!window.__SAB_SIDEBAR_INTERVAL__) {
        window.__SAB_SIDEBAR_INTERVAL__ = true;
        setInterval(() => {
            if (!document.getElementById(SIDEBAR_ID)) buildSidebar();
        }, 1000);
    }

})();
