const savedDataDiv = document.getElementById("savedData");
const dataNameInput = document.getElementById("dataName");

async function getCurrentTabUrl() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url;
}

//
function renderSavedTags(dataObj) {
  savedDataDiv.innerHTML = "";
  if (!dataObj || Object.keys(dataObj).length === 0) {
    savedDataDiv.textContent = "(無已儲存資料)";
    return;
  }

  Object.entries(dataObj).forEach(([tag, inputs]) => {
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
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      chrome.tabs.sendMessage(tab.id, { action: "fillInputs", data: inputs });
    });
  
    tagTitle.appendChild(titleSpan);
    tagTitle.appendChild(loadBtn);

    const tagData = document.createElement("pre");
    tagData.className = "tag-data";

    // 只有密碼欄顯示星號，其餘正常顯示內容
    const displayTexts = inputs.map((item) => {
      console.log(item.value)
      if (item.type === "password") return "*******";
      return item.value;
    });
    console.log({ displayTexts });

    tagData.textContent = displayTexts.join("\n");

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
  const tag = dataNameInput.value.trim();
  if (!tag) {
    alert("請先輸入資料名稱 (Tag)");
    return;
  }
  const url = await getCurrentTabUrl();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "getInputs" }, (inputs) => {
    if (chrome.runtime.lastError) {
      console.error(
        "❌ 無法發送訊息到 content script：",
        chrome.runtime.lastError.message,
        "請重新整理網頁再試試看",
      );
    }
    chrome.storage.local.get([url], (result) => {
      const dataForUrl = result[url] || {};
      dataForUrl[tag] = inputs;
      chrome.storage.local.set({ [url]: dataForUrl }, () => {
        alert(`已儲存資料「${tag}」`);
        dataNameInput.value = "";
        loadDataForCurrentUrl();
      });
    });
  });
});

document.getElementById("clear").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "clearInputs" }, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "❌ 無法發送訊息到 content script：",
        chrome.runtime.lastError.message,
        "請重新整理網頁再試試看",
      );
    }
  });
});

async function setDefaultTagName() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.title) {
    // 預設填入標題
    dataNameInput.value = tab.title;
  }
}

// 頁面載入時，讀取並顯示資料，並預設輸入欄位為標題
loadDataForCurrentUrl();
setDefaultTagName();
