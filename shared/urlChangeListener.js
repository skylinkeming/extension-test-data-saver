// ========================================
// URL 變化監聽模組
// ========================================

class UrlChangeListener {
  constructor(hoverManager) {
    this.hoverManager = hoverManager;
    this.currentUrl = window.location.href;
    this.observer = null;
  }

  init() {
    this.setupMutationObserver();
    this.setupPopstateListener();
    console.log("✅ 網址變化監聽器已啟動");
  }

  setupMutationObserver() {
    this.observer = new MutationObserver(() => {
      if (this.hasUrlChanged()) {
        this.handleUrlChange();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  setupPopstateListener() {
    window.addEventListener("popstate", () => {
      console.log("🔍 Popstate 事件觸發");
      this.reinitializeHoverManager();
    });
  }

  hasUrlChanged() {
    return window.location.href !== this.currentUrl;
  }

  handleUrlChange() {
    this.currentUrl = window.location.href;
    console.log("🔍 網址變化偵測到:", this.currentUrl);
    this.reinitializeHoverManager();
  }

  reinitializeHoverManager() {
    this.hoverManager.cleanup();
    setTimeout(() => {
      this.hoverManager.init();
      console.log("✅ 重新初始化懸停監聽完成");
    }, 500);
  }
}
