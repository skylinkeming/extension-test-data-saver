// content.js - 精簡版（依賴 shared/data-matcher.js 和 shared/input-handler.js）

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("🔍 Content script 收到消息:", request);

  if (request.action === "getInputs") {
    const allInputs = getAllInputs().map((item) => ({
      value: item.value,
      type: item.type,
    }));
    console.log("🔍 發送輸入資料:", allInputs);
    sendResponse(allInputs);
    return true;
  } else if (request.action === "fillInputs") {
    const data = request.data;
    loadTestDataToInputs(data); // 使用 shared/input-handler.js 中的函數
    sendResponse({ success: true });
    return true;
  } else if (request.action === "clearInputs") {
    const inputs = getAllInputs();
    inputs.forEach((input) => {
      if (input instanceof HTMLInputElement) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (isElementInIframe(input)) {
        handleIframeInput(input);
      } else {
        console.warn(`跳过无效的 input 元素:`, input);
      }
    });
    sendResponse({ success: true, clearedCount: inputs.length });
    return true;
  }

  return false;
});

// iframe 相關函數
function isElementInIframe(element) {
  return (
    element.ownerDocument?.defaultView &&
    element.ownerDocument.defaultView !== window
  );
}

function handleIframeInput(input) {
  try {
    const iframeWindow = input.ownerDocument.defaultView;
    if (!iframeWindow) {
      console.warn("無法取得 iframe 的 window 物件");
      return;
    }

    const inputEvent = new iframeWindow.Event("input", { bubbles: true });
    input.value = "";
    input.dispatchEvent(inputEvent);
    console.log("成功在 iframe 中觸發 input 事件:", input);
  } catch (e) {
    console.error("處理 iframe 內的 input 元素時發生錯誤:", e);
  }
}

// 懸停顯示測試資料按鈕的功能
let testDataButton = null;
let testDataDropdown = null;
let currentHoveredInput = null;
let hideTimer = null;
let isInitialized = false;

// 檢查當前頁面是否有相關的測試資料
async function hasTestDataForCurrentPage() {
  const currentInputCount = getAllInputs().length;
  return await findMatchingTestData(window.location.href, currentInputCount);
}

// 創建測試資料按鈕
function createTestDataButton() {
  if (testDataButton) return testDataButton;

  testDataButton = document.createElement("div");
  testDataButton.id = "test-data-button";
  testDataButton.style.cssText = `
    position: fixed;
    z-index: 9999;
    background: linear-gradient(135deg, #8ec2b5 0%, #4e9e94 100%);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    user-select: none;
    pointer-events: auto;
    transition: all 0.2s ease;
    white-space: nowrap;
    display: none;
  `;
  testDataButton.textContent = "📋 帶入測試資料";

  document.body.appendChild(testDataButton);
  return testDataButton;
}

// 創建測試資料下拉選單
function createTestDataDropdown() {
  if (testDataDropdown) return testDataDropdown;

  testDataDropdown = document.createElement("div");
  testDataDropdown.id = "test-data-dropdown";
  testDataDropdown.style.cssText = `
    position: fixed;
    z-index: 10000;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    border: 1px solid #e0e0e0;
    max-height: 300px;
    overflow-y: auto;
    min-width: 200px;
    max-width: 400px;
    user-select: none;
    pointer-events: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: none;
  `;

  document.body.appendChild(testDataDropdown);
  return testDataDropdown;
}

// 顯示測試資料下拉選單
async function showTestDataDropdown() {
  const testData = await hasTestDataForCurrentPage();
  if (testData.length === 0) return;

  const dropdown = createTestDataDropdown();
  dropdown.innerHTML = "";

  // 添加標題
  const title = document.createElement("div");
  title.style.cssText = `
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #2c3e50;
    border-bottom: 1px solid #e9ecef;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 8px 8px 0 0;
  `;
  title.textContent = "選擇要載入的測試資料";
  dropdown.appendChild(title);

  // 添加測試資料選項
  testData.forEach((item, index) => {
    const option = document.createElement("div");
    option.style.cssText = `
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: ${
        index < testData.length - 1 ? "1px solid #f0f0f0" : "none"
      };
      transition: background 0.2s ease;
      font-size: 13px;
    `;

    const tagName = document.createElement("div");
    tagName.style.cssText = `
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 2px;
    `;
    tagName.textContent = `📝 ${item.tag}`;

    const pageInfo = document.createElement("div");
    pageInfo.style.cssText = `
      font-size: 11px;
      color: #6c757d;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    `;
    pageInfo.textContent = `${item.pageTitle} [${
      item.matchType === "strict" ? "嚴格匹配" : "寬鬆匹配"
    }]`;

    option.appendChild(tagName);
    option.appendChild(pageInfo);

    option.addEventListener("mouseenter", () => {
      option.style.background =
        "linear-gradient(135deg, #e8f4f0 0%, #d1eddf 100%)";
    });

    option.addEventListener("mouseleave", () => {
      option.style.background = "transparent";
    });

    option.addEventListener("click", () => {
      loadTestDataToInputs(item.data);
      hideTestDataElements();
    });

    dropdown.appendChild(option);
  });

  // 定位下拉選單
  if (testDataButton) {
    const buttonRect = testDataButton.getBoundingClientRect();
    dropdown.style.left = `${buttonRect.left}px`;
    dropdown.style.top = `${buttonRect.bottom}px`;
    dropdown.style.display = "block";
  }
}

// 顯示測試資料按鈕
function showTestDataButton(input) {
  const button = createTestDataButton();

  // 獲取 input 的位置信息
  const rect = input.getBoundingClientRect();

  // 直接在 input 正上方顯示，使用固定定位
  const buttonLeft = rect.left;
  const buttonTop = rect.top - 35; // 在 input 上方 35px

  button.style.left = `${buttonLeft}px`;
  button.style.top = `${buttonTop}px`;
  button.style.display = "block";
  button.style.opacity = "1";

  currentHoveredInput = input;

  console.log(`按鈕位置: left=${buttonLeft}, top=${buttonTop}`);
}

// 隱藏測試資料元素
function hideTestDataElements() {
  clearTimeout(hideTimer);

  if (testDataButton) {
    testDataButton.style.display = "none";
    testDataButton.style.opacity = "0";
  }

  if (testDataDropdown) {
    testDataDropdown.style.display = "none";
  }

  currentHoveredInput = null;
}

// 動態更新按鈕位置
function updateButtonPosition() {
  if (
    !testDataButton ||
    !currentHoveredInput ||
    testDataButton.style.display === "none"
  ) {
    return;
  }

  const input = currentHoveredInput;
  const rect = input.getBoundingClientRect();

  // 檢查 input 是否還在視窗中
  if (rect.width === 0 && rect.height === 0) {
    hideTestDataElements();
    return;
  }

  // 直接在 input 正上方
  const buttonLeft = rect.left;
  const buttonTop = rect.top - 35;

  testDataButton.style.left = `${buttonLeft}px`;
  testDataButton.style.top = `${buttonTop}px`;
}

// 處理文檔級別的滑鼠進入事件
async function handleDocumentMouseOver(e) {
  const target = e.target;

  // 如果滑鼠進入按鈕區域
  if (target.id === "test-data-button") {
    clearTimeout(hideTimer);
    target.style.background =
      "linear-gradient(135deg, #7fb8a8 0%, #388e6c 100%)";
    target.style.transform = "translateY(-1px)";
    showTestDataDropdown();
    return;
  }

  // 如果滑鼠進入下拉選單區域
  if (
    target.id === "test-data-dropdown" ||
    target.closest("#test-data-dropdown")
  ) {
    clearTimeout(hideTimer);
    return;
  }

  // 如果滑鼠進入 input 元素
  if (target.tagName.toLowerCase() === "input" && target.type !== "hidden") {
    clearTimeout(hideTimer);
    const testData = await hasTestDataForCurrentPage();
    if (testData.length > 0) {
      showTestDataButton(target);
    }
  }
}

// 處理文檔級別的滑鼠離開事件
function handleDocumentMouseOut(e) {
  const target = e.target;
  const relatedTarget = e.relatedTarget;

  // 如果從按鈕離開
  if (target.id === "test-data-button") {
    target.style.background =
      "linear-gradient(135deg, #8ec2b5 0%, #4e9e94 100%)";
    target.style.transform = "translateY(0)";

    // 檢查是否移到下拉選單
    if (
      !relatedTarget ||
      (relatedTarget.id !== "test-data-dropdown" &&
        !relatedTarget.closest("#test-data-dropdown"))
    ) {
      hideTimer = setTimeout(hideTestDataElements, 300);
    }
    return;
  }

  // 如果從下拉選單離開
  if (
    target.id === "test-data-dropdown" ||
    target.closest("#test-data-dropdown")
  ) {
    // 檢查是否移到按鈕
    if (!relatedTarget || relatedTarget.id !== "test-data-button") {
      hideTimer = setTimeout(hideTestDataElements, 300);
    }
    return;
  }

  // 如果從 input 離開
  if (target.tagName.toLowerCase() === "input") {
    // 檢查是否移到按鈕或下拉選單
    if (
      !relatedTarget ||
      (relatedTarget.id !== "test-data-button" &&
        relatedTarget.id !== "test-data-dropdown" &&
        !relatedTarget.closest("#test-data-dropdown"))
    ) {
      hideTimer = setTimeout(hideTestDataElements, 300);
    }
  }
}

// 使用事件委派的方式處理懸停
function initHoverListeners() {
  // 防止重複初始化
  if (isInitialized) {
    console.log("懸停監聽器已初始化，跳過重複初始化");
    return;
  }

  // 移除舊的事件監聽器
  document.removeEventListener("mouseover", handleDocumentMouseOver);
  document.removeEventListener("mouseout", handleDocumentMouseOut);
  window.removeEventListener("scroll", updateButtonPosition);
  window.removeEventListener("resize", updateButtonPosition);

  // 添加事件委派監聽器
  document.addEventListener("mouseover", handleDocumentMouseOver);
  document.addEventListener("mouseout", handleDocumentMouseOut);

  // 添加滾動和視窗大小變化監聽
  window.addEventListener("scroll", updateButtonPosition, { passive: true });
  window.addEventListener("resize", updateButtonPosition, { passive: true });

  isInitialized = true;
  console.log("✅ 懸停監聽器已初始化（事件委派）");
}

// 清理函數
function cleanupHoverListeners() {
  document.removeEventListener("mouseover", handleDocumentMouseOver);
  document.removeEventListener("mouseout", handleDocumentMouseOut);
  window.removeEventListener("scroll", updateButtonPosition);
  window.removeEventListener("resize", updateButtonPosition);

  if (testDataButton) {
    testDataButton.remove();
    testDataButton = null;
  }

  if (testDataDropdown) {
    testDataDropdown.remove();
    testDataDropdown = null;
  }

  clearTimeout(hideTimer);
  isInitialized = false;
  console.log("✅ 懸停監聽器已清理");
}

// 監聽網址變化並重新初始化懸停監聽
function setupUrlChangeListener() {
  let currentUrl = window.location.href;

  // 使用 MutationObserver 監聽 DOM 變化（適用於 SPA）
  const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log("🔍 網址變化偵測到:", currentUrl);

      // 清理並重新初始化
      cleanupHoverListeners();
      setTimeout(() => {
        initHoverListeners();
        console.log("✅ 重新初始化懸停監聽完成");
      }, 500);
    }
  });

  // 開始觀察 DOM 變化
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // 監聽 popstate 事件（瀏覽器前進/後退）
  window.addEventListener("popstate", () => {
    console.log("🔍 Popstate 事件觸發");
    cleanupHoverListeners();
    setTimeout(() => {
      initHoverListeners();
      console.log("✅ Popstate 重新初始化完成");
    }, 500);
  });

  console.log("✅ 網址變化監聽器已啟動");
}

// 初始化
console.log("✅ content script injected");

// 啟動懸停監聽
initHoverListeners();

// 啟動網址變化監聽
setupUrlChangeListener();

console.log("✅ 測試資料懸停功能已啟動");
