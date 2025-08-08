// 通用工具函數

// 通用的刪除單筆資料函數
async function deleteTagDataGeneric(url, tag, options = {}) {
    const {
        confirmMessage = `確定要刪除標籤 "${tag}" 的資料嗎？`,
        onSuccess = null,
        updateUI = true,
        useLocalData = true // manage.js 使用 allData，popup.js 重新讀取
    } = options;
    
    if (confirm(confirmMessage)) {
        try {
            let existingData;
            
            if (useLocalData && typeof allData !== 'undefined' && allData[url]) {
                // manage.js 情況：使用本地 allData
                delete allData[url][tag];
                existingData = allData[url];
            } else {
                // popup.js 情況：重新從 storage 讀取
                const result = await chrome.storage.local.get([url]);
                if (result[url]) {
                    existingData = result[url];
                    delete existingData[tag];
                } else {
                    throw new Error('資料不存在');
                }
            }
            
            // 檢查是否還有其他資料（排除元數據）
            const remainingData = Object.keys(existingData).filter(key => !key.startsWith('_'));
            
            if (remainingData.length === 0) {
                // 沒有真實資料了，刪除整個 key
                await chrome.storage.local.remove([url]);
                if (useLocalData && typeof allData !== 'undefined') {
                    delete allData[url];
                }
            } else {
                // 還有其他資料，更新 storage
                await chrome.storage.local.set({ [url]: existingData });
            }
            
            console.log(`✅ 成功刪除標籤: ${tag}`);
            
            // 執行成功回調
            if (onSuccess) {
                onSuccess();
            }
            
            // 更新 UI
            if (updateUI) {
                if (typeof updateStats !== 'undefined') updateStats();
                if (remainingData.length === 0 && typeof showWebsiteView !== 'undefined') {
                    showWebsiteView();
                } else if (typeof renderDataList !== 'undefined') {
                    renderDataList(url);
                }
            }
            
            alert('資料已刪除');
        } catch (error) {
            console.error('刪除失敗:', error);
            alert('刪除失敗，請重試');
        }
    }
}

// 複製到剪貼板函數
async function copyToClipboard(text, element) {
    try {
        await navigator.clipboard.writeText(text);
        showCopyTooltip(element);
    } catch (err) {
        console.error('無法複製到剪貼板:', err);
        // 備用方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopyTooltip(element);
    }
}

// 顯示複製提示 - Snackbar 樣式
function showCopyTooltip(element) {
    // 創建 Snackbar
    const snackbar = document.createElement('div');
    snackbar.className = 'snackbar';
    snackbar.innerHTML = `
        <span class="snackbar-icon">✅</span>
        <span class="snackbar-text">複製完成!</span>
    `;
    
    // 添加到頁面底部
    document.body.appendChild(snackbar);
    
    // 顯示動畫
    setTimeout(() => {
        snackbar.classList.add('show');
    }, 10);
    
    // 3秒後隱藏
    setTimeout(() => {
        snackbar.classList.remove('show');
        setTimeout(() => {
            if (snackbar.parentNode) {
                snackbar.parentNode.removeChild(snackbar);
            }
        }, 300);
    }, 3000);
}
