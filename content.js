// ========================================
// 消息處理模組
// ========================================
// content.js - 修改消息處理部分

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("🔍 Content script 收到消息:", request);

  const messageHandlers = {
    getInputs: handleGetInputs,
    fillInputs: handleFillInputs,
    clearInputs: handleClearInputs,
  };

  const handler = messageHandlers[request.action];
  if (handler) {
    handler(request, sendResponse);
    return true;
  }

  return false;
});

// 🔧 修改：使用新的函數獲取輸入值
function handleGetInputs(request, sendResponse) {
  const allInputValues = getAllInputValues(); // 🔧 使用新函數，保持順序
  console.log("🔍 發送輸入資料:", allInputValues);
  sendResponse(allInputValues);
}

function handleFillInputs(request, sendResponse) {
  loadTestDataToInputs(request.data);
  sendResponse({ success: true });
}

function handleClearInputs(request, sendResponse) {
  const inputs = getAllInputs();
  const clearedCount = clearAllInputs(inputs);
  sendResponse({ success: true, clearedCount });
}

function clearAllInputs(inputs) {
  inputs.forEach((input) => {
    if (input instanceof HTMLInputElement) {
      clearRegularInput(input);
    } else if (isElementInIframe(input)) {
      clearIframeInput(input);
    } else {
      console.warn(`跳過無效的 input 元素:`, input);
    }
  });
  return inputs.length;
}

function clearRegularInput(input) {
  // 🔧 根據類型清理
  if (input.type === "radio" || input.type === "checkbox") {
    input.checked = false;
  } else {
    input.value = "";
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function clearIframeInput(input) {
  try {
    const iframeWindow = input.ownerDocument.defaultView;
    if (!iframeWindow) {
      console.warn("無法取得 iframe 的 window 物件");
      return;
    }

    if (input.type === "radio" || input.type === "checkbox") {
      input.checked = false;
    } else {
      input.value = "";
    }

    const inputEvent = new iframeWindow.Event("input", { bubbles: true });
    const changeEvent = new iframeWindow.Event("change", { bubbles: true });
    input.dispatchEvent(inputEvent);
    input.dispatchEvent(changeEvent);
    console.log("成功在 iframe 中觸發事件:", input);
  } catch (e) {
    console.error("處理 iframe 內的 input 元素時發生錯誤:", e);
  }
}

function isElementInIframe(element) {
  return (
    element.ownerDocument?.defaultView &&
    element.ownerDocument.defaultView !== window
  );
}

// ========================================
// 主程式初始化
// ========================================

function initializeContentScript() {
  console.log("✅ content script injected");

  const hoverManager = new TestDataHoverManager();
  const urlListener = new UrlChangeListener(hoverManager);

  hoverManager.init();
  urlListener.init();

  console.log("✅ 測試資料懸停功能已啟動");
}

// 啟動應用程式
initializeContentScript();
