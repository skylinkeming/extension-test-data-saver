const savedDataDiv = document.getElementById("savedData");
const dataNameInput = document.getElementById("dataName");

async function getCurrentTabUrl() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url;
}

async function getCurrentTabInfo() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    url: tab.url,
    title: tab.title || "未知頁面",
  };
}

// 通用的消息發送函數，處理特殊頁面檢查、content script 注入和錯誤處理
async function sendMessageToContentScript(action, data = null) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    console.log("🔍 當前分頁:", tab);

    if (!tab || !tab.id) {
      throw new Error("無法獲取當前分頁資訊");
    }

    // 檢查是否為特殊頁面
    if (
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://") ||
      tab.url.startsWith("edge://") ||
      tab.url.startsWith("about:")
    ) {
      throw new Error("SPECIAL_PAGE");
    }

    console.log(`🔍 發送 ${action} 訊息到分頁 ID:`, tab.id);

    // 先嘗試注入 content script（以防萬一）
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      console.log("🔍 Content script 注入成功");
    } catch (injectionError) {
      console.log(
        "🔍 Content script 可能已經存在或注入失敗:",
        injectionError.message
      );
    }

    // 返回 Promise 來處理消息發送
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const message = data ? { action, data } : { action };
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          console.log("🔍 收到回應:", response);
          console.log("🔍 lastError:", chrome.runtime.lastError);

          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            console.error("❌ 無法發送訊息到 content script：", errorMsg);

            if (
              errorMsg.includes("Could not establish connection") ||
              errorMsg.includes("Receiving end does not exist")
            ) {
              reject(new Error("CONNECTION_FAILED"));
            } else {
              reject(new Error(errorMsg));
            }
            return;
          }

          resolve(response);
        });
      }, 100);
    });
  } catch (error) {
    throw error;
  }
}

// 處理不同類型錯誤的通用函數
function handleMessageError(error, actionName) {
  console.error(`🔍 ${actionName} 操作過程中發生錯誤:`, error);

  if (error.message === "SPECIAL_PAGE") {
    alert(`此擴展無法在瀏覽器內建頁面上運作，請在一般網站上使用`);
  } else if (error.message === "CONNECTION_FAILED") {
    alert(
      `此頁面不支援自動${actionName}功能。\n可能原因：\n1. 頁面尚未完全載入\n2. 頁面限制了擴展運行\n3. 這是特殊類型的頁面\n\n請重新整理頁面後再試，或在其他網站使用此功能。`
    );
  } else {
    alert(`${actionName}失敗: ${error.message}`);
  }
}

//
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

    // 點擊後把儲存的資料塞到網頁的input裡面
    loadBtn.textContent = "載入";
    loadBtn.addEventListener("click", async () => {
      try {
        await sendMessageToContentScript("fillInputs", inputs);
        console.log("✅ 成功載入資料到網頁");
      } catch (error) {
        handleMessageError(error, "載入");
      }
    });

    // 刪除按鈕
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "刪除";
    deleteBtn.addEventListener("click", async () => {
      try {
        const url = await getCurrentTabUrl();
        await deleteTagDataGeneric(url, tag, {
          confirmMessage: `確定要刪除 "${
            tag.slice(0, 10) || "(無標題)"
          }" 的資料嗎？`,
          useLocalData: false, // popup.js 不使用 allData
          updateUI: false, // 不使用 manage.js 的 UI 更新函數
          onSuccess: () => {
            console.log(`✅ 成功刪除標籤: ${tag}`);
            // 重新載入資料顯示
            loadDataForCurrentUrl();
          },
        });
      } catch (error) {
        console.error("❌ 刪除資料時發生錯誤:", error);
      }
    });

    // 創建按鈕容器，讓兩個按鈕靠近
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "button-group";
    buttonGroup.appendChild(loadBtn);
    buttonGroup.appendChild(deleteBtn);

    tagTitle.appendChild(titleSpan);
    tagTitle.appendChild(buttonGroup);

    const tagData = document.createElement("pre");
    tagData.className = "tag-data";

    // 只顯示每個值一行，點擊可複製該行
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
      if (idx < inputs.length - 1)
        tagData.appendChild(document.createElement("br"));
    });

    tagItem.appendChild(tagTitle);
    tagItem.appendChild(tagData);
    savedDataDiv.appendChild(tagItem);

    tagItem.appendChild(tagTitle);
    tagItem.appendChild(tagData);
    savedDataDiv.appendChild(tagItem);

    console.log(savedDataDiv);
  });
}

async function loadDataForCurrentUrl() {
  const url = await getCurrentTabUrl();
  console.log(`Loading data for URL: ${url}`);
  chrome.storage.local.get([url], (result) => {
    const dataForUrl = result[url] || {};
    renderSavedTags(dataForUrl);
  });
}

document.getElementById("save").addEventListener("click", async () => {
  console.log("🔍 儲存按鈕被點擊");
  const tag = dataNameInput.value.trim();
  if (!tag) {
    alert("請先輸入資料名稱 (Tag)");
    return;
  }

  try {
    console.log("🔍 開始獲取分頁資訊...");
    const tabInfo = await getCurrentTabInfo();
    console.log("🔍 分頁資訊:", tabInfo);

    console.log("🔍 開始獲取輸入資料...");
    const inputs = await sendMessageToContentScript("getInputs");
    console.log("🔍 獲取到的輸入資料:", inputs);

    // 使用 Promise 包裝 chrome.storage API
    console.log("🔍 開始讀取現有資料...");
    const result = await new Promise((resolve) => {
      chrome.storage.local.get([tabInfo.url], resolve);
    });
    console.log("🔍 現有資料:", result);

    const dataForUrl = result[tabInfo.url] || {};

    // 保存網頁標題資訊
    dataForUrl._pageTitle = tabInfo.title;
    dataForUrl._lastUpdated = new Date().toISOString();

    dataForUrl[tag] = inputs;
    console.log("🔍 準備儲存的資料:", dataForUrl);

    console.log("🔍 開始儲存資料...");
    await new Promise((resolve) => {
      chrome.storage.local.set({ [tabInfo.url]: dataForUrl }, resolve);
    });

    dataNameInput.value = "";
    loadDataForCurrentUrl();
    console.log("✅ 資料儲存成功");
  } catch (error) {
    console.error("❌ 儲存過程中發生錯誤:", error);
    handleMessageError(error, "儲存");
  }
});

document.getElementById("clear").addEventListener("click", async () => {
  console.log("🔍 開始清除操作...");

  try {
    const response = await sendMessageToContentScript("clearInputs");
    console.log("✅ 成功清除輸入欄位");
  } catch (error) {
    handleMessageError(error, "清除");
  }
});

document.getElementById("manage").addEventListener("click", () => {
  // 開啟管理頁面
  chrome.tabs.create({
    url: chrome.runtime.getURL("manage.html"),
  });
});

function showCopySnackbar(msg) {
  // 若已存在則先移除
  let old = document.getElementById("copy-snackbar");
  if (old) old.remove();

  const snackbar = document.createElement("div");
  snackbar.id = "copy-snackbar";
  snackbar.textContent = msg;
  snackbar.style.position = "fixed";
  snackbar.style.left = "50%";
  snackbar.style.bottom = "40px";
  snackbar.style.transform = "translateX(-50%)";
  snackbar.style.background = "rgba(60,60,60,0.95)";
  snackbar.style.color = "#fff";
  snackbar.style.padding = "12px 28px";
  snackbar.style.borderRadius = "24px";
  snackbar.style.fontSize = "1.1em";
  snackbar.style.zIndex = 9999;
  snackbar.style.boxShadow = "0 2px 12px rgba(0,0,0,0.18)";
  snackbar.style.opacity = "0";
  snackbar.style.transition = "opacity 0.2s";

  document.body.appendChild(snackbar);
  setTimeout(() => {
    snackbar.style.opacity = "1";
  }, 10);
  setTimeout(() => {
    snackbar.style.opacity = "0";
    setTimeout(() => snackbar.remove(), 300);
  }, 1800);
}

// 頁面載入時，讀取並顯示資料
loadDataForCurrentUrl();
