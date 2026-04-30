if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js")
            .then(reg => console.log("[info] service worker registered:", reg.scope))
            .catch(err => console.error("service worker failed:", err));
    });
}
