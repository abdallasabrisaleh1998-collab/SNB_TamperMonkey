(function() {
    'use strict';

    if (window.__SAB_MASTER_PRO__) return;
    window.__SAB_MASTER_PRO__ = true;

    const SIDEBAR_ID = 'sab-helper-sidebar';
    let antiLogoutInterval = null;

    // --- وظائف المساعدة للوصول للعناصر داخل الـ IFrames ---
    const getDoc = () => {
        const iframe = document.querySelector('iframe#legacyIframe, iframe[name="legacyIframe"]');
        return iframe ? (iframe.contentDocument || iframe.contentWindow.document) : document;
    };

    const getEl = (selector) => getDoc().querySelector(selector);

    // --- دالة فك حماية الحقول (Paste & Type) ---
    const unlockField = (selector) => {
        const el = getEl(selector);
        if (!el) return;
        el.removeAttribute('onpaste');
        el.removeAttribute('oncopy');
        el.removeAttribute('readonly');
        el.style.backgroundColor = "#fff9c4"; // تمييز الحقل المفكوك بلون أصفر خفيف
        if (el.type === 'password') el.type = 'text'; // تحويله لنص عشان تشوف اللي بتلصقه
        
        // منع أي كود خارجي من تعطيل اللصق
        el.addEventListener('paste', (e) => e.stopPropagation(), true);
    };

    // --- دالة اختيار من قائمة Chosen ---
    const setChosenSelect = (selectId, value) => {
        const doc = getDoc();
        const selectEl = doc.getElementById(selectId);
        if (!selectEl) return;
        
        selectEl.value = value;
        const event = new Event('change', { bubbles: true });
        selectEl.dispatchEvent(event);

        // تحديث واجهة Chosen (المهمة جداً)
        try {
            const win = doc.defaultView;
            if (win.$) {
                win.$(`#${selectId}`).trigger("chosen:updated").trigger("change");
            }
        } catch (e) { console.log("Chosen update failed"); }
    };

    // --- دالة النسخ الاحترافية ---
    const copyToClipboard = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    };

    // --- بناء الواجهة ---
    const buildSidebar = () => {
        if (document.getElementById(SIDEBAR_ID)) return;

        const sidebar = document.createElement('div');
        sidebar.id = SIDEBAR_ID;
        sidebar.innerHTML = `
            <style>
                #${SIDEBAR_ID} { position: fixed; right: 0; top: 15%; width: 240px; background: #fff; border: 2px solid #e11d1d; 
                z-index: 9999999; border-radius: 12px 0 0 12px; box-shadow: -5px 0 15px rgba(0,0,0,0.2); font-family: Arial; direction: rtl; }
                .sab-header { background: #e11d1d; color: #fff; padding: 12px; font-weight: bold; text-align: center; border-radius: 10px 0 0 0; }
                .sab-content { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
                .sab-btn { background: #fefefe; border: 1px solid #ddd; padding: 10px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: bold; transition: 0.2s; display: flex; justify-content: space-between; align-items: center; }
                .sab-btn:hover { background: #fff1f1; border-color: #e11d1d; transform: translateX(-5px); }
                .sab-btn.active { background: #28a745; color: #fff; }
                .sab-divider { font-size: 10px; color: #999; margin-top: 5px; border-top: 1px solid #eee; padding-top: 5px; }
                .sab-input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 12px; box-sizing: border-box; }
            </style>
            <div class="sab-header">🛠️ لوحة ساب الشاملة</div>
            <div class="sab-content">
                <button id="btn-copy-main" class="sab-btn"><span>نسخ وتحميل</span> 📥</button>
                <button id="btn-fill-data" class="sab-btn"><span>فك الحماية وملء</span> ⚡</button>
                <button id="btn-tansheet" class="sab-btn"><span>تنشيط الجلسة</span> 🔄</button>
                
                <div class="sab-divider">تقسيم العنوان</div>
                <textarea id="addr-input" class="sab-input" placeholder="ضع العنوان هنا..." rows="2"></textarea>
                <button id="btn-split" class="sab-btn" style="background:#444; color:#fff; justify-content:center;">تقسيم العنوان ✂️</button>
                <div id="split-results"></div>
            </div>
        `;
        document.body.appendChild(sidebar);

        // 1. زر النسخ والتحميل
        document.getElementById('btn-copy-main').onclick = function() {
            const doc = getDoc();
            const labels = Array.from(doc.querySelectorAll('label.custLabel'));
            const find = (t) => {
                const l = labels.find(el => el.innerText.includes(t));
                return l ? l.closest('tr').querySelector('td:last-child').innerText.trim() : "";
            };

            const name = find('Beneficiary Name').split(/\s+/).slice(0, 2).join(' ');
            const amt = find('Transfer Amount').split('.')[0];
            const acc = find('From Account Number');

            if (name && amt) {
                copyToClipboard(`${name} $ ${amt} ${acc}`);
                doc.getElementById('payment_advice_download')?.click();
                this.style.background = "#28a745"; setTimeout(() => this.style.background = "#fefefe", 1500);
            } else { alert("لم يتم العثور على البيانات!"); }
        };

        // 2. فك الحماية وملء البيانات (طلبك الجديد)
        document.getElementById('btn-fill-data').onclick = function() {
            // فك الحماية عن الحقول اللي حددتها
            unlockField('#beneficiaryAccNo');
            unlockField('#confimrbeneficiaryAccNo'); // مع مراعاة السبيلنج confirm
            unlockField('#forBeneficiary');

            // اختيار Other من القائمة
            setChosenSelect('purposeOfTransferCODE', 'OTHER_PURPOSE');

            // ملء الحقول
            setTimeout(() => {
                const inv = `INV-${Date.now().toString().slice(-6)}`;
                const targetField = getEl('#forBeneficiary');
                if (targetField) targetField.value = inv;
                
                const otherField = getEl('#otherPurposeOfTransfer');
                if (otherField) { 
                    unlockField('#otherPurposeOfTransfer');
                    otherField.value = 'PURCHASE OF GOODS';
                }
            }, 600);

            this.style.background = "#28a745"; setTimeout(() => this.style.background = "#fefefe", 1500);
        };

        // 3. زر التنشيط (Tansheet)
        const tansheetBtn = document.getElementById('btn-tansheet');
        tansheetBtn.onclick = function() {
            if (antiLogoutInterval) {
                clearInterval(antiLogoutInterval);
                antiLogoutInterval = null;
                this.classList.remove('active');
                this.innerHTML = "<span>تنشيط الجلسة</span> 🔄";
            } else {
                this.classList.add('active');
                this.innerHTML = "<span>نشط (كل 10ث)</span> 🟢";
                antiLogoutInterval = setInterval(() => {
                    const logoutWarning = document.querySelector("#appwrapper > header > a");
                    if (logoutWarning) logoutWarning.click();
                    console.log("SAB: Session Refreshed");
                }, 10000);
            }
        };

        // 4. تقسيم العنوان
        document.getElementById('btn-split').onclick = function() {
            const val = document.getElementById('addr-input').value;
            const words = val.trim().split(/\s+/);
            let lines = ["", "", ""];
            let curr = 0;

            words.forEach(w => {
                if (curr > 2) return;
                if ((lines[curr] + w).length <= 35) {
                    lines[curr] += (lines[curr] ? " " : "") + w;
                } else {
                    curr++;
                    if (curr <= 2) lines[curr] = w.substring(0, 35);
                }
            });

            const resDiv = document.getElementById('split-results');
            resDiv.innerHTML = lines.filter(l => l).map((l, i) => `
                <div style="display:flex; gap:5px; margin-top:5px;">
                    <input class="sab-input" value="${l}" readonly style="font-size:10px;">
                    <button class="sab-btn" style="padding:2px 8px;" onclick="document.execCommand('copy') || navigator.clipboard.writeText('${l}')">📋</button>
                </div>
            `).join('');
        };
    };

    // تشغيل وبناء
    setInterval(buildSidebar, 2000);

})();
