// popup.js - 精簡版（依賴 shared/data-matcher.js）

const savedDataDiv = document.getElementById("savedData");
const dataNameInput = document.getElementById("dataName");

async function getCurrentTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url;
}

async function getCurrentTabInfo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    url: tab.url,
    title: tab.title,
    id: tab.id,
  };
}

// 通用的消息發送函數，處理特殊頁面檢查、content script 注入和錯誤處理
async function sendMessageToContentScript(action, data = null) {
  try {
    const tabInfo = await getCurrentTabInfo();
    const tabId = tabInfo.id;
    const url = tabInfo.url;

    // 檢查是否為特殊頁面
    if (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:")
    ) {
      throw new Error("special_page");
    }

    // 嘗試注入 content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: [
          "shared/data-matcher.js",
          "shared/input-handler.js",
          "content.js",
        ],
      });
    } catch (injectionError) {
      console.warn("Content script 可能已存在:", injectionError.message);
    }

    // 發送消息
    const response = await chrome.tabs.sendMessage(tabId, {
      action: action,
      data: data,
    });

    return response;
  } catch (error) {
    throw error;
  }
}

// 處理不同類型錯誤的通用函數
function handleMessageError(error, actionName) {
  console.error(`❌ ${actionName}時發生錯誤:`, error);

  if (error.message === "special_page") {
    showStatusMessage(
      `❌ 無法在此頁面執行${actionName}操作（系統頁面）`,
      "error"
    );
  } else if (error.message?.includes("receiving end does not exist")) {
    showStatusMessage(`❌ 頁面尚未準備就緒，請重新整理後再試`, "error");
  } else if (error.message?.includes("frame was removed")) {
    showStatusMessage(`❌ 頁面結構已變更，請重新整理後再試`, "error");
  } else {
    showStatusMessage(`❌ ${actionName}失敗: ${error.message}`, "error");
  }
}

// 顯示狀態消息
function showStatusMessage(message, type = "info") {
  // 創建或更新狀態消息元素
  let statusDiv = document.getElementById("status-message");
  if (!statusDiv) {
    statusDiv = document.createElement("div");
    statusDiv.id = "status-message";
    statusDiv.style.cssText = `
      margin: 10px 0;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      text-align: center;
    `;
    document.body.insertBefore(statusDiv, document.body.firstChild);
  }

  // 設置樣式和內容
  statusDiv.textContent = message;
  if (type === "error") {
    statusDiv.style.background = "#ffe6e6";
    statusDiv.style.color = "#d32f2f";
    statusDiv.style.border = "1px solid #ffcdd2";
  } else {
    statusDiv.style.background = "#e8f5e8";
    statusDiv.style.color = "#2e7d32";
    statusDiv.style.border = "1px solid #c8e6c9";
  }

  // 3秒後自動隱藏
  setTimeout(() => {
    if (statusDiv) {
      statusDiv.remove();
    }
  }, 3000);
}

// 顯示複製成功的 snackbar
function showCopySnackbar(message) {
  showStatusMessage(message, "info");
}

// 使用 shared/data-matcher.js 中的函數來載入資料
async function loadDataForCurrentUrl() {
  const currentUrl = await getCurrentTabUrl();

  console.log(`Loading data for URL: ${currentUrl}`);

  try {
    // 獲取當前頁面的 input 數量
    const currentPageInputs = await sendMessageToContentScript("getInputs");
    const currentInputCount = currentPageInputs ? currentPageInputs.length : 0;

    console.log(`🔍 當前頁面 input 數量: ${currentInputCount}`);

    // 使用 shared/data-matcher.js 中的函數
    const matchingData = await findMatchingTestData(
      currentUrl,
      currentInputCount
    );

    // 處理重複標籤
    const processedData = handleDuplicateTags(matchingData);

    // 轉換為 renderSavedTags 期望的格式
    const dataForRender = {};
    processedData.forEach((item) => {
      dataForRender[item.tag] = item.data;
    });

    console.log("Processed matching data:", dataForRender);
    renderSavedTags(dataForRender);
  } catch (error) {
    console.error("❌ 無法獲取當前頁面 input 數量:", error);

    // 錯誤處理：回退到簡單匹配
    try {
      const strictMatchKey = generateStrictMatchKey(currentUrl);
      const looseMatchKey = generateLooseMatchKey(currentUrl);

      chrome.storage.local.get(null, (allData) => {
        const matchingData = {};

        // 先嘗試嚴格匹配
        let found = false;
        Object.keys(allData).forEach((storedUrl) => {
          const storedStrictKey = generateStrictMatchKey(storedUrl);

          if (storedStrictKey === strictMatchKey && storedStrictKey !== null) {
            const urlData = allData[storedUrl];
            Object.keys(urlData).forEach((tag) => {
              if (!tag.startsWith("_")) {
                matchingData[tag] = urlData[tag];
                found = true;
              }
            });
          }
        });

        // 如果嚴格匹配沒找到，使用寬鬆匹配
        if (!found) {
          Object.keys(allData).forEach((storedUrl) => {
            const storedLooseKey = generateLooseMatchKey(storedUrl);

            if (storedLooseKey === looseMatchKey && storedLooseKey !== null) {
              const urlData = allData[storedUrl];
              Object.keys(urlData).forEach((tag) => {
                if (!tag.startsWith("_")) {
                  if (matchingData[tag]) {
                    const urlSuffix = storedUrl
                      .split("/")
                      .pop()
                      .substring(0, 8);
                    matchingData[`${tag}_${urlSuffix}`] = urlData[tag];
                  } else {
                    matchingData[tag] = urlData[tag];
                  }
                }
              });
            }
          });
        }

        console.log("Fallback matching data:", matchingData);
        renderSavedTags(matchingData);
      });
    } catch (fallbackError) {
      console.error("❌ 回退匹配也失敗:", fallbackError);
      renderSavedTags({});
    }
  }
}

// 渲染已儲存的標籤（保持原有邏輯）
function renderSavedTags(dataObj) {
  savedDataDiv.innerHTML = "";
  if (!dataObj || Object.keys(dataObj).length === 0) {
    savedDataDiv.textContent = "(無已儲存資料)";
    return;
  }

  Object.entries(dataObj).forEach(([tag, inputs]) => {
    // 跳過元數據（以 _ 開頭的 key）
    if (tag.startsWith("_")) return;

    // 確保 inputs 是數組
    if (!Array.isArray(inputs)) {
      console.warn("跳過非數組資料:", tag, inputs);
      return;
    }

    const tagItem = document.createElement("div");
    tagItem.className = "tag-item";

    const tagTitle = document.createElement("div");
    tagTitle.className = "tag-title";

    const titleSpan = document.createElement("span");
    titleSpan.textContent = tag.slice(0, 10) || "(無標題)";

    const loadBtn = document.createElement("button");
    loadBtn.className = "load-btn";
    loadBtn.textContent = "載入";
    loadBtn.addEventListener("click", async () => {
      try {
        await sendMessageToContentScript("fillInputs", inputs);
        console.log("✅ 成功載入資料到網頁");
        showStatusMessage("✅ 測試資料載入成功！");
      } catch (error) {
        handleMessageError(error, "載入");
      }
    });

    // 刪除按鈕（簡化邏輯）
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "刪除";
    deleteBtn.addEventListener("click", async () => {
      if (
        confirm(`確定要刪除 "${tag.slice(0, 10) || "(無標題)"}" 的資料嗎？`)
      ) {
        try {
          const currentUrl = await getCurrentTabUrl();
          const strictMatchKey = generateStrictMatchKey(currentUrl);
          const looseMatchKey = generateLooseMatchKey(currentUrl);

          chrome.storage.local.get(null, async (allData) => {
            let foundUrl = null;

            // 先嘗試嚴格匹配找到要刪除的資料
            Object.keys(allData).forEach((storedUrl) => {
              const storedStrictKey = generateStrictMatchKey(storedUrl);
              if (
                storedStrictKey === strictMatchKey &&
                allData[storedUrl][tag]
              ) {
                foundUrl = storedUrl;
              }
            });

            // 如果嚴格匹配找不到，嘗試寬鬆匹配
            if (!foundUrl) {
              Object.keys(allData).forEach((storedUrl) => {
                const storedLooseKey = generateLooseMatchKey(storedUrl);
                if (
                  storedLooseKey === looseMatchKey &&
                  allData[storedUrl][tag]
                ) {
                  foundUrl = storedUrl;
                }
              });
            }

            if (foundUrl) {
              const urlData = allData[foundUrl];
              delete urlData[tag];

              chrome.storage.local.set({ [foundUrl]: urlData }, () => {
                console.log(`✅ 成功刪除標籤: ${tag}`);
                showStatusMessage("✅ 測試資料刪除成功！");
                loadDataForCurrentUrl(); // 重新載入資料
              });
            } else {
              console.error("找不到要刪除的資料");
              showStatusMessage("❌ 找不到要刪除的資料", "error");
            }
          });
        } catch (error) {
          console.error("❌ 刪除資料時發生錯誤:", error);
          handleMessageError(error, "刪除");
        }
      }
    });

    // 創建按鈕容器
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "button-group";
    buttonGroup.appendChild(loadBtn);
    buttonGroup.appendChild(deleteBtn);

    tagTitle.appendChild(titleSpan);
    tagTitle.appendChild(buttonGroup);

    const tagData = document.createElement("pre");
    tagData.className = "tag-data";

    // 顯示資料內容
    inputs.forEach((item, idx) => {
      const valueSpan = document.createElement("span");
      valueSpan.className = "tag-data-value";
      valueSpan.style.cursor = "pointer";
      valueSpan.title = "點擊複製";

      if (item.type === "password") {
        valueSpan.textContent = "*******";
        valueSpan.setAttribute("data-copy-value", item.value);
      } else {
        valueSpan.textContent = item.value;
        valueSpan.setAttribute("data-copy-value", item.value);
      }

      valueSpan.addEventListener("click", function () {
        const val = this.getAttribute("data-copy-value");
        navigator.clipboard
          .writeText(val)
          .then(() => {
            showCopySnackbar("複製成功！");
          })
          .catch(() => {
            showCopySnackbar("複製失敗");
          });
      });

      tagData.appendChild(valueSpan);
      if (idx < inputs.length - 1) {
        tagData.appendChild(document.createElement("br"));
      }
    });

    tagItem.appendChild(tagTitle);
    tagItem.appendChild(tagData);
    savedDataDiv.appendChild(tagItem);
  });
}

// 儲存資料功能（保持原有邏輯）
document.getElementById("save").addEventListener("click", async () => {
  const tagName = dataNameInput.value.trim();
  if (!tagName) {
    showStatusMessage("❌ 請輸入資料名稱", "error");
    return;
  }

  try {
    const tabInfo = await getCurrentTabInfo();
    const inputs = await sendMessageToContentScript("getInputs");

    if (!inputs || inputs.length === 0) {
      showStatusMessage("❌ 當前頁面沒有可儲存的輸入欄位", "error");
      return;
    }

    // 儲存資料
    chrome.storage.local.get(tabInfo.url, (result) => {
      const urlData = result[tabInfo.url] || {};
      urlData[tagName] = inputs;
      urlData._pageTitle = tabInfo.title;
      urlData._savedAt = new Date().toISOString();

      chrome.storage.local.set({ [tabInfo.url]: urlData }, () => {
        console.log("✅ 資料已儲存:", tagName, inputs);
        showStatusMessage(`✅ 資料 "${tagName}" 儲存成功！`);
        dataNameInput.value = "";
        loadDataForCurrentUrl();
      });
    });
  } catch (error) {
    handleMessageError(error, "儲存");
  }
});

// 清空輸入欄位功能
document.getElementById("clear").addEventListener("click", async () => {
  try {
    const result = await sendMessageToContentScript("clearInputs");
    console.log("✅ 成功清空輸入欄位:", result);
    showStatusMessage(`✅ 已清空 ${result.clearedCount} 個輸入欄位`);
  } catch (error) {
    handleMessageError(error, "清空輸入欄位");
  }
});

// 管理測試資料功能
document.getElementById("manage").addEventListener("click", () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("manage.html"),
  });
});

// 頁面載入時執行
document.addEventListener("DOMContentLoaded", () => {
  loadDataForCurrentUrl();
});
