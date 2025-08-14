// 管理頁面的主要邏輯
let allData = {};
let currentView = "website"; // 'website' 或 'detail'
let currentWebsite = "";

// DOM 元素
const websiteView = document.getElementById("websiteView");
const detailView = document.getElementById("detailView");
const websiteList = document.getElementById("websiteList");
const dataList = document.getElementById("dataList");
const searchInput = document.getElementById("searchInput");
const backBtn = document.getElementById("backBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const exportSiteBtn = document.getElementById("exportSiteBtn");
const deleteSiteBtn = document.getElementById("deleteSiteBtn");
const currentWebsiteTitle = document.getElementById("currentWebsite");
const currentWebsiteUrl = document.getElementById("currentWebSiteUrl");
const totalSites = document.getElementById("totalSites");
const totalData = document.getElementById("totalData");

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  loadAllData();
  setupEventListeners();
});

// 載入所有資料
async function loadAllData() {
  try {
    const result = await chrome.storage.local.get(null);
    allData = {};

    // 尋找所有包含測試資料的 keys
    Object.keys(result).forEach((key) => {
      if (typeof result[key] === "object" && result[key] !== null) {
        const data = result[key];
        const hasTestDataStructure = Object.values(data).some(
          (value) =>
            Array.isArray(value) &&
            value.some(
              (item) =>
                item &&
                typeof item === "object" &&
                ("type" in item || "value" in item)
            )
        );
        if (hasTestDataStructure) {
          allData[key] = data;
        }
      }
    });

    updateStats();
    showWebsiteView();
  } catch (error) {
    console.error("載入資料失敗:", error);
  }
}

// 設定事件監聽器
function setupEventListeners() {
  backBtn.addEventListener("click", showWebsiteView);
  exportBtn.addEventListener("click", exportAllData);
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", importData);
  exportSiteBtn.addEventListener("click", exportSiteData);
  deleteSiteBtn.addEventListener("click", deleteSiteData);
  searchInput.addEventListener("input", filterWebsites);
  currentWebsiteUrl.addEventListener("click", goToSite);
}

function goToSite() {
  if (currentWebsite) {
    chrome.tabs.create({ url: currentWebsite });
  }
}

// 顯示網站列表視圖
function showWebsiteView() {
  currentView = "website";
  websiteView.style.display = "block";
  detailView.style.display = "none";
  backBtn.style.display = "none";
  renderWebsiteList();
}

// 顯示網站詳情視圖
function showDetailView(url) {
  currentView = "detail";
  currentWebsite = url;
  websiteView.style.display = "none";
  detailView.style.display = "block";
  backBtn.style.display = "inline-block";
  currentWebsiteTitle.textContent = getDisplayTitle(url);
  currentWebsiteUrl.textContent = url;

  renderDataList(url);
}

// 渲染網站列表
function renderWebsiteList() {
  const websites = Object.keys(allData);

  if (websites.length === 0) {
    websiteList.innerHTML = `
            <div class="empty-state">
                <h3>📭 暫無測試資料</h3>
                <p>還沒有儲存任何測試資料，快去網站上試試吧！</p>
            </div>
        `;
    return;
  }

  websiteList.innerHTML = "";

  websites.forEach((url) => {
    const data = allData[url];
    const dataCount = Object.keys(data).filter(
      (key) => !key.startsWith("_")
    ).length;
    const lastUpdated = getLastUpdated(data);

    const websiteItem = document.createElement("div");
    websiteItem.className = "website-item";
    websiteItem.innerHTML = `
            <div class="website-title">${getDisplayTitle(url)}</div>
            <div class="website-info">
                <span class="data-count">${dataCount} 筆資料</span>
                <span class="last-updated">${lastUpdated}</span>
            </div>
        `;

    websiteItem.addEventListener("click", () => showDetailView(url));
    websiteList.appendChild(websiteItem);
  });
}

// 渲染資料列表
function renderDataList(url) {
  const data = allData[url];

  if (!data || Object.keys(data).length === 0) {
    dataList.innerHTML = `
            <div class="empty-state">
                <h3>📭 此網站暫無資料</h3>
                <p>這個網站還沒有儲存任何測試資料</p>
            </div>
        `;
    return;
  }

  dataList.innerHTML = "";

  Object.keys(data).forEach((tag) => {
    // 跳過元數據（以 _ 開頭的 key）
    if (tag.startsWith("_")) return;

    const inputs = data[tag];
    const dataItem = document.createElement("div");
    dataItem.className = "data-item";

    // 標題部分
    const dataHeader = document.createElement("div");
    dataHeader.className = "data-header";

    const dataTag = document.createElement("span");
    dataTag.className = "data-tag";
    dataTag.textContent = `📝 ${tag}`;

    const dataActions = document.createElement("div");
    dataActions.className = "data-actions";

    // --- 複製到其他頁面功能 ---
    const copyBtn = document.createElement("button");
    copyBtn.className = "data-btn copy";
    copyBtn.textContent = "📋 複製到其他頁面";
    // 統一按鈕顏色
    copyBtn.style.background = "#5bc0de";
    copyBtn.style.color = "#fff";
    copyBtn.style.border = "none";

    // 點擊複製按鈕時彈出 popup
    copyBtn.addEventListener("click", () => {
      showCopyPopup(url, tag, inputs);
    });

    dataActions.appendChild(copyBtn);

    // --- 其他操作按鈕 ---
    // 匯出
    const exportBtn = document.createElement("button");
    exportBtn.className = "data-btn export";
    exportBtn.textContent = "📤 匯出";
    exportBtn.addEventListener("click", () => exportTagData(url, tag));

    // 刪除
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "data-btn delete";
    deleteBtn.textContent = "🗑️ 刪除";
    deleteBtn.addEventListener("click", () => deleteTagData(url, tag));

    dataActions.appendChild(exportBtn);
    dataActions.appendChild(deleteBtn);

    dataHeader.appendChild(dataTag);
    dataHeader.appendChild(dataActions);

    // 資料內容
    const dataContent = document.createElement("div");
    dataContent.className = "data-content";

    // 為每個輸入值創建可點擊的元素
    inputs.forEach((item, index) => {
      const valueSpan = document.createElement("span");
      valueSpan.className = "data-value";

      if (item.type === "password") {
        valueSpan.textContent = "*******";
        valueSpan.setAttribute("data-copy-value", item.value); // 儲存真實密碼值
      } else {
        valueSpan.textContent = item.value;
        valueSpan.setAttribute("data-copy-value", item.value);
      }

      // 添加點擊複製功能
      valueSpan.addEventListener("click", function () {
        const valueToClip = this.getAttribute("data-copy-value");
        copyToClipboard(valueToClip, this);
      });

      dataContent.appendChild(valueSpan);

      // 添加換行（除了最後一個元素）
      if (index < inputs.length - 1) {
        dataContent.appendChild(document.createElement("br"));
      }
    });

    // 組裝完整的資料項目
    dataItem.appendChild(dataHeader);
    dataItem.appendChild(dataContent);

    dataList.appendChild(dataItem);
  });
}

// 複製到其他頁面 popup
function showCopyPopup(currentUrl, tag, inputs) {
  // 遮罩
  const mask = document.createElement("div");
  mask.className = "copy-popup-mask";

  // popup 主體
  const popup = document.createElement("div");
  popup.className = "copy-popup";

  // 標題
  const title = document.createElement("div");
  title.className = "copy-popup-title";
  title.textContent = "複製到其他網站";

  // 下拉選單
  const dropdown = document.createElement("select");
  Object.keys(allData).forEach((siteUrl) => {
    if (siteUrl !== currentUrl) {
      const opt = document.createElement("option");
      opt.value = siteUrl;
      opt.textContent = getDisplayTitle(siteUrl);
      dropdown.appendChild(opt);
    }
  });

  // 沒有其他網站時
  if (dropdown.options.length === 0) {
    const msg = document.createElement("div");
    msg.textContent = "沒有其他可複製的網站";
    popup.appendChild(title);
    popup.appendChild(msg);
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "popup-btn cancel";
    cancelBtn.textContent = "關閉";
    cancelBtn.onclick = () => document.body.removeChild(mask);
    popup.appendChild(cancelBtn);
    mask.appendChild(popup);
    document.body.appendChild(mask);
    return;
  }

  // 按鈕
  const confirmBtn = document.createElement("button");
  confirmBtn.className = "popup-btn confirm";
  confirmBtn.textContent = "確定";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "popup-btn cancel";
  cancelBtn.textContent = "取消";

  // 點擊確定
  confirmBtn.onclick = async () => {
    const targetUrl = dropdown.value;
    if (!targetUrl) return;
    const targetData = allData[targetUrl] || {};
    if (targetData[tag]) {
      if (!confirm(`目標網站已存在 "${tag}"，要覆蓋嗎？`)) return;
    }
    targetData[tag] = JSON.parse(JSON.stringify(inputs));
    await chrome.storage.local.set({ [targetUrl]: targetData });
    await loadAllData();
    document.body.removeChild(mask);
    alert("複製成功！");
  };

  // 點擊取消
  cancelBtn.onclick = () => document.body.removeChild(mask);

  // 組裝 popup
  popup.appendChild(title);
  popup.appendChild(dropdown);
  popup.appendChild(confirmBtn);
  popup.appendChild(cancelBtn);
  mask.appendChild(popup);
  document.body.appendChild(mask);
}

// 更新統計資訊
function updateStats() {
  const websites = Object.keys(allData);
  const totalDataCount = Object.values(allData).reduce((total, siteData) => {
    return (
      total +
      Object.entries(siteData).filter(
        ([key, value]) => !key.startsWith("_") && Array.isArray(value)
      ).length
    );
  }, 0);

  totalSites.textContent = websites.length;
  totalData.textContent = totalDataCount;
}

// 獲取顯示標題（優先顯示網頁標題）
function getDisplayTitle(url) {
  const data = allData[url];
  if (data && data._pageTitle) {
    return data._pageTitle.slice(0, 80);
  }
  return getDisplayUrl(url);
}

// 獲取顯示用的 URL
function getDisplayUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch {
    return url.length > 50 ? url.substring(0, 50) + "..." : url;
  }
}

// 獲取最後更新時間
function getLastUpdated(data) {
  if (data._lastUpdated) {
    const date = new Date(data._lastUpdated);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }
  return "未知時間";
}

// 過濾網站
function filterWebsites() {
  const query = searchInput.value.toLowerCase();
  const items = websiteList.querySelectorAll(".website-item");

  items.forEach((item) => {
    const title = item
      .querySelector(".website-title")
      .textContent.toLowerCase();
    if (title.includes(query)) {
      item.style.display = "block";
    } else {
      item.style.display = "none";
    }
  });
}

// 匯出所有資料
function exportAllData() {
  const dataStr = JSON.stringify(allData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `test-data-backup-${
    new Date().toISOString().split("T")[0]
  }.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 匯入資料
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);

      // 確認是否覆蓋現有資料
      if (Object.keys(allData).length > 0) {
        if (!confirm("匯入資料會覆蓋現有資料，確定要繼續嗎？")) {
          return;
        }
      }

      // 直接儲存到 chrome.storage.local（不需要 testData_ 前綴）
      await chrome.storage.local.clear(); // 清除現有資料
      await chrome.storage.local.set(importedData);

      // 重新載入
      loadAllData();
      alert("資料匯入成功！");
    } catch (error) {
      console.error("匯入失敗:", error);
      alert("匯入失敗，請檢查檔案格式");
    }
  };
  reader.readAsText(file);
}

// 匯出單個網站資料
function exportSiteData() {
  const data = { [currentWebsite]: allData[currentWebsite] };
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${getDisplayTitle(currentWebsite)}-data.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 刪除網站所有資料
async function deleteSiteData() {
  if (
    confirm(
      `確定要刪除 "${getDisplayTitle(currentWebsite)}" 的所有測試資料嗎？`
    )
  ) {
    try {
      await chrome.storage.local.remove([currentWebsite]);
      delete allData[currentWebsite];
      updateStats();
      showWebsiteView();
      alert("網站資料已刪除");
    } catch (error) {
      console.error("刪除失敗:", error);
      alert("刪除失敗，請重試");
    }
  }
}

// 匯出單筆資料
function exportTagData(url, tag) {
  const data = { [url]: { [tag]: allData[url][tag] } };
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `${tag}-data.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

// 刪除單筆資料，調用通用函數
async function deleteTagData(url, tag) {
  await deleteTagDataGeneric(url, tag, {
    useLocalData: true,
    updateUI: true,
  });
}
