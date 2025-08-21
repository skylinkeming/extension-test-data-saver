// ========================================
// URL 變化監聽模組
// ========================================

class UrlChangeListener {
  constructor(hoverManager) {
    this.hoverManager = hoverManager;
    this.currentUrl = window.location.href;
    this.observer = null;
    this.isListening = false;
  }

  // 🔧 修改：初始化時先檢查是否有測試資料
  async init() {
    const hasTestData = await this.checkIfPageHasTestData();
    if (!hasTestData) {
      console.log("❌ 當前頁面沒有測試資料，跳過網址變化監聽器初始化");
      return;
    }

    this.setupMutationObserver();
    this.setupPopstateListener();
    this.isListening = true;
    console.log("✅ 網址變化監聽器已啟動");
  }

  // 🔧 新增：檢查當前頁面是否有測試資料的方法
  async checkIfPageHasTestData() {
    try {
      const currentInputCount = getAllInputs().length;
      const testData = await findMatchingTestData(window.location.href, currentInputCount);
      return testData && testData.length > 0;
    } catch (error) {
      console.error("檢查測試資料時發生錯誤:", error);
      return false;
    }
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

  // 🔧 修改：網址變化時也要檢查新頁面是否有測試資料
  async handleUrlChange() {
    this.currentUrl = window.location.href;
    console.log("🔍 網址變化偵測到:", this.currentUrl);
    await this.reinitializeHoverManager();
  }

  // 🔧 修改：重新初始化時先檢查測試資料
  async reinitializeHoverManager() {
    // 先清理現有的懸停管理器
    this.hoverManager.cleanup();
    
    setTimeout(async () => {
      // 檢查新頁面是否有測試資料
      const hasTestData = await this.checkIfPageHasTestData();
      if (hasTestData) {
        await this.hoverManager.init();
        console.log("✅ 重新初始化懸停監聽完成 - 有測試資料");
      } else {
        console.log("❌ 新頁面沒有測試資料，跳過懸停監聽器初始化");
      }
    }, 500);
  }

  // 🔧 新增：清理方法
  cleanup() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // 移除 popstate 監聽器
    window.removeEventListener("popstate", this.reinitializeHoverManager.bind(this));
    
    this.isListening = false;
    console.log("✅ 網址變化監聽器已清理");
  }

  // 🔧 新增：獲取監聽狀態
  getListeningStatus() {
    return this.isListening;
  }
}