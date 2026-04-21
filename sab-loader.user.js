// ==UserScript==
// @name         SAB Master Loader
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Load all SAB tools from GitHub
// @match        https://sabicorp.sab.com/Corporate/*
// @grant        none

// 👇 اللودر نفسه بيتحدث من هنا
// @updateURL   https://raw.githubusercontent.com/abdallasabrisaleh1998-collab/SNB_TamperMonkey/main/sab-loader.user.js
// @downloadURL https://raw.githubusercontent.com/abdallasabrisaleh1998-collab/SNB_TamperMonkey/main/sab-loader.user.js
// ==/UserScript==

(async function() {
    'use strict';

    if (window.__SAB_LOADER__) {
        console.log("⛔ Loader already running");
        return;
    }
    window.__SAB_LOADER__ = true;

    const scripts = [
        "https://raw.githubusercontent.com/abdallasabrisaleh1998-collab/SNB_TamperMonkey/main/Sab_Bank_Tools.js",
        "https://raw.githubusercontent.com/abdallasabrisaleh1998-collab/SNB_TamperMonkey/main/Sab_Collect_Reports_For_Sayad.js"
    ];

    for (const url of scripts) {
        try {
            const res = await fetch(url);
            const code = await res.text();

            const script = document.createElement('script');
            script.textContent = code;
            document.documentElement.appendChild(script);

            console.log("✅ Loaded:", url);
        } catch (err) {
            console.error("❌ Failed:", url, err);
        }
    }
})();
