// SAB EL AWL SMART PANEL - STABLE VERSION
(function() {
    'use strict';

    if (window.__SAB_PANEL_LOADED__) return;
    window.__SAB_PANEL_LOADED__ = true;

    const SIDEBAR_ID = 'sab-helper-sidebar';

    // --- وظائف المساعدة الأساسية ---
    const getIframeDoc = () => {
        const iframe = document.querySelector('iframe#legacyIframe, iframe[name="legacyIframe"]');
        if (!iframe) return document;
        try { return iframe.contentDocument || iframe.contentWindow.document; } catch (e) { return document; }
    };

    const copyToClipboard = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('فشل النسخ:', err);
        }
        document.body.removeChild(textArea);
    };

    const unlockField = (el) => {
        if (!el) return;
        el.removeAttribute('onpaste');
        el.removeAttribute('oncopy');
        el.removeAttribute('oncut');
        el.removeAttribute('readonly');
        // فك حماية المستمعين (Listeners)
        el.onpaste = null;
        // تغيير النوع لنص لضمان القبول
        if (el.tagName === 'INPUT') el.setAttribute('type', 'text');
    };

    // --- منطق تقسيم العنوان (المحسن) ---
    const splitAddressLogic = (text) => {
        const words = text.trim().split(/\s+/);
        let lines = ["", "", ""];
        let currentLine = 0;

        for (let word of words) {
            if (currentLine > 2) break;
            
            let testLine = lines[currentLine] ? lines[currentLine] + " " + word : word;
            
            if (testLine.length <= 35) {
                lines[currentLine] = testLine;
            } else {
                currentLine++;
                if (currentLine <= 2) {
                    lines[currentLine] = word.substring(0, 35);
                }
            }
        }
        return lines.filter(l => l !== "");
    };

    // --- بناء اللوحة ---
    const buildSidebar = () => {
        if (document.getElementById(SIDEBAR_ID)) return;

        const sidebar = document.createElement('div');
        sidebar.id = SIDEBAR_ID;
        sidebar.innerHTML = `
            <style>
                #${SIDEBAR_ID} { position: fixed; right: 0; top: 15%; width: 240px; background: #fff; border: 2px solid #e11d1d; 
                z-index: 9999999; border-radius: 12px 0 0 12px; box-shadow: -5px 0 15px rgba(0,0,0,0.2); font-family: Arial; direction: rtl; }
                .sab-header { background: #e11d1d; color: #fff; padding: 10px; font-weight: bold; text-align: center; }
                .sab-content { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
                .sab-btn { background: #f9f9f9; border: 1px solid #ddd; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; transition: 0.3s; }
                .sab-btn:hover { background: #fff1f1; border-color: #e11d1d; }
                .sab-input { width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; margin-bottom: 5px; }
                .line-res { display: flex; justify-content: space-between; align-items: center; background: #eee; padding: 4px; border-radius: 4px; margin-top: 2px; font-size: 10px; }
                .copy-small { background: #e11d1d; color: #fff; border: none; padding: 2px 5px; border-radius: 3px; cursor: pointer; }
            </style>
            <div class="sab-header">🛠️ أدوات ساب المتطورة</div>
            <div class="sab-content">
                <button id="btn-copy-download" class="sab-btn">📥 نسخ وتحميل التقرير</button>
                <button id="btn-unlock-fill" class="sab-btn">⚡ فك الحماية وملء البيانات</button>
                <hr>
                <div style="font-size: 11px; font-weight: bold; color: #666;">✂️ تقسيم العنوان (35 حرف):</div>
                <textarea id="addr-input" class="sab-input" placeholder="ضع العنوان هنا..." rows="2"></textarea>
                <button id="btn-split" class="sab-btn" style="background:#444; color:#fff;">تقسيم</button>
                <div id="split-results"></div>
            </div>
        `;
        document.body.appendChild(sidebar);

        // --- أحداث الأزرار ---

        // 1. نسخ وتحميل
        document.getElementById('btn-copy-download').onclick = function() {
            const doc = getIframeDoc();
            const labels = Array.from(doc.querySelectorAll('label.custLabel'));
            const findVal = (txt) => {
                const l = labels.find(el => el.innerText.includes(txt));
                if (!l) return "";
                const td = l.closest('tr').querySelector('td:last-child');
                return td ? td.innerText.trim() : "";
            };

            const bName = findVal('Beneficiary Name').split(/\s+/).slice(0, 2).join(' ');
            const amt = findVal('Transfer Amount').split('.')[0];
            const acc = findVal('From Account Number');

            if (!bName || !amt) { alert("بيانات غير مكتملة!"); return; }

            copyToClipboard(`${bName} $ ${amt} ${acc}`);
            const downBtn = doc.getElementById('payment_advice_download') || document.getElementById('payment_advice_download');
            if (downBtn) downBtn.click();
            this.innerText = "✅ تم النسخ";
            setTimeout(() => this.innerText = "📥 نسخ وتحميل التقرير", 2000);
        };

        // 2. فك الحماية والملء
        document.getElementById('btn-unlock-fill').onclick = function() {
            const doc = getIframeDoc();
            // قائمة بكل الـ IDs المحتملة للحماية
            const ids = ['beneficiaryAccNo', 'otherPurposeOfTransfer', 'forAccount', 'forBeneficiary', 'purposeOfTransferCODE'];
            
            ids.forEach(id => {
                const el = doc.getElementById(id);
                if (el) unlockField(el);
            });

            // ملء تجريبي
            const purpose = doc.getElementById('purposeOfTransferCODE');
            if (purpose) {
                purpose.value = 'OTHER_PURPOSE';
                purpose.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            setTimeout(() => {
                const other = doc.getElementById('otherPurposeOfTransfer');
                if (other) other.value = 'PURCHASE OF GOODS';
                const forAcc = doc.getElementById('forAccount');
                if (forAcc) forAcc.value = 'PURCHASE OF GOODS';
                this.innerText = "✅ تم فك الحماية";
            }, 500);
        };

        // 3. التقسيم
        document.getElementById('btn-split').onclick = function() {
            const input = document.getElementById('addr-input').value;
            const results = splitAddressLogic(input);
            const container = document.getElementById('split-results');
            container.innerHTML = '';

            results.forEach((line, i) => {
                const div = document.createElement('div');
                div.className = 'line-res';
                div.innerHTML = `
                    <span style="width: 140px; overflow: hidden;">${i+1}: ${line}</span>
                    <button class="copy-small" data-text="${line}">نسخ</button>
                `;
                container.appendChild(div);
            });

            container.querySelectorAll('.copy-small').forEach(b => {
                b.onclick = () => {
                    copyToClipboard(b.getAttribute('data-text'));
                    b.innerText = "👍";
                    setTimeout(() => b.innerText = "نسخ", 1000);
                };
            });
        };
    };

    // التشغيل المتكرر لضمان الظهور في صفحات الـ Ajax
    setInterval(buildSidebar, 2000);

})();
