// ==UserScript==
// @name         SAB Transactions Extractor - Final Footer Fix
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Targeted footer button for closing modals in SAB
// @author       Gemini
// @match        https://sabicorp.sab.com/Corporate/apps/home*
// @match        https://www.sabicorp.sab.com/Corporate/apps/home*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if (window.__SAB_EXTRACTOR__) {
        console.log("⛔ Extractor already running");
        return;
    }
    window.__SAB_EXTRACTOR__ = true;
    
    const SAB_COMPANY_NAMES = {
        "SASABB815515424001": "WEDAD SAB"
    };

    function createUI() {
        const btn = document.createElement('button');
        btn.id = "extractorBtn";
        btn.innerHTML = '🚀 سحب بيانات ساب (Final)';
        btn.style = "position:fixed; top:20px; left:20px; z-index:99999; padding:15px 25px; background:#e1122a; color:white; border-radius:30px; border:none; cursor:pointer; font-weight:bold; box-shadow: 0 4px 15px rgba(0,0,0,0.4); border: 2px solid white;";
        btn.onclick = startSABExtraction;
        document.body.appendChild(btn);
    }

    function findInDocuments(selector) {
        let element = document.querySelector(selector);
        if (element) return element;
        const iframes = document.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
            try {
                const iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                element = iframeDoc.querySelector(selector);
                if (element) return element;
            } catch (e) {}
        }
        return null;
    }

    function getAllRows() {
        let rows = document.querySelectorAll("#data tbody tr[role='row']");
        if (rows.length > 0) return Array.from(rows);
        const iframes = document.querySelectorAll('iframe');
        for (let i = 0; i < iframes.length; i++) {
            try {
                const iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                rows = iframeDoc.querySelectorAll("#data tbody tr[role='row']");
                if (rows.length > 0) return Array.from(rows);
            } catch (e) {}
        }
        return [];
    }

    async function startSABExtraction() {
        const btn = document.getElementById("extractorBtn");
        const rows = getAllRows();

        if (rows.length === 0) {
            alert("⚠️ الجدول مظهرش! افتح فريم الجدول الأول وجرب تاني.");
            return;
        }

        btn.style.background = "#555";
        let allData = [];

        for (let i = 0; i < rows.length; i++) {
            const link = rows[i].querySelector("td.sorting_1 u a") || rows[i].querySelector("a[onclick*='showPage']");

            if (link) {
                btn.innerHTML = `⏳ سحب معاملة ${i + 1} من ${rows.length}`;
                link.click();

                // انتظار تحميل الموديل
                await new Promise(r => setTimeout(r, 3000));

                try {
                    const modal = findInDocuments("#print-me");
                    if (modal) {
                        const myAccount = modal.querySelector("tr:nth-child(13) td:nth-child(2)")?.innerText.trim() || "";
                        const beneName = modal.querySelector("tr:nth-child(9) td:nth-child(2)")?.innerText.trim() || "";
                        const transId = modal.querySelector("tr:nth-child(27) td:nth-child(2)")?.innerText.trim() || "";
                        const uniqueNumber = modal.querySelector("tr:nth-child(29) td:nth-child(2)")?.innerText.trim() || "";

                        const fullAmountRaw = modal.querySelector("tr:nth-child(16) td:nth-child(2)")?.innerText.trim() || "";
                        const currencyOnly = fullAmountRaw.match(/[A-Z]{3}/)?.[0] || "USD";
                        const amountOnly = fullAmountRaw.replace(/[A-Z]{3}/g, '').trim();

                        const sarAmountRaw = modal.querySelector("tr:nth-child(14) td:nth-child(2)")?.innerText.trim() || "";
                        const sarAmount = sarAmountRaw.replace("SAR", "").trim();

                        const nickName = SAB_COMPANY_NAMES[myAccount] || "WEDAD SAB";
                        const beneFirstTwo = beneName.split(' ').slice(0, 2).join(' ');
                        const fileName = `${beneFirstTwo} $ ${amountOnly} ${nickName}`;

                        allData.push({
                            "File Name": fileName,
                            "Unique Number": uniqueNumber,
                            "Amount (Original)": amountOnly,
                            "Currency": currencyOnly,
                            "Amount (SAR)": sarAmount,
                            "Beneficiary Name": beneName,
                            "Nick Name": nickName,
                            "Transaction ID": transId
                        });
                        console.log(`✅ تم سحب ${uniqueNumber}`);
                    }
                } catch (err) { console.error(err); }

                // --- التعديل الجوهري هنا لقفل الموديل ---
                const closeBtn = findInDocuments("#test > div > div > div.modal-footer > button") ||
                      findInDocuments(".modal-footer button") ||
                      findInDocuments("[data-dismiss='modal']");

                if (closeBtn) {
                    closeBtn.click();
                    // انتظار ثانية ونصف لضمان اختفاء الموديل تماماً قبل العملية التالية
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        }

        btn.innerHTML = '🚀 بدء سحب بيانات ساب';
        btn.style.background = "#e1122a";
        downloadSABCSV(allData);
    }

    // excel file for 365 version
    function downloadSABCSV(data) {
        if (data.length === 0) return alert("فشل السحب، لم نجد بيانات.");

        const headers = ["File Name", "Unique Number", "Amount (Original)", "Currency", "Amount (SAR)", "Beneficiary Name", "Nick Name", "Transaction ID"];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
    <?mso-application progid="Excel.Sheet"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Worksheet ss:Name="SAB Report">
            <Table>
                <Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>`;

        data.forEach(row => {
            xml += `<Row>${Object.values(row).map(v => `<Cell><Data ss:Type="String">${v}</Data></Cell>`).join('')}</Row>`;
        });

        xml += `</Table></Worksheet></Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `SAB_Report_Final.xls`;
        link.click();
    }

    // this is excel file for under 365 version
    /*
    function downloadSABCSV(data) {
        if (data.length === 0) return alert("فشل السحب، لم نجد بيانات.");

        const headers = ["File Name", "Unique Number", "Amount (Original)", "Currency", "Amount (SAR)", "Beneficiary Name", "Nick Name", "Transaction ID"];

        let excelContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"></head>
    <body><table><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;

        data.forEach(row => {
            excelContent += `<tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>`;
        });

        excelContent += "</table></body></html>";

        const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `SAB_Report_Final.xls`;
        link.click();
    }
*/
    // this is for CSV file
    /*

    function downloadSABCSV(data) {
        if (data.length === 0) return alert("فشل السحب، لم نجد بيانات داخل الموديلات.");
        const separator = ";";
        const headers = ["File Name", "Unique Number", "Amount (Original)", "Currency", "Amount (SAR)", "Beneficiary Name", "Nick Name", "Transaction ID"].join(separator);
        const csvRows = data.map(row => Object.values(row).map(v => `"${v}"`).join(separator));
        const csvContent = "\uFEFF" + [headers, ...csvRows].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `SAB_Report_Final.csv`;
        link.click();
    }
*/

    createUI();
})();
