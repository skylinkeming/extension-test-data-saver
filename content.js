chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("🔍 Content script 收到消息:", request);

  if (request.action === "getInputs") {
    // 抓取一般的 input 元素
    const regularInputs = Array.from(document.querySelectorAll("input")).map(
      (el) => ({
        value: el.value,
        type: el.type || "text",
        element: el,
      })
    );

    // 抓取 MUI Select 組件
    const muiSelects = Array.from(
      document.querySelectorAll(".MuiSelect-select")
    ).map((el) => {
      // 找到隱藏的 input 來獲取實際值
      const container =
        el.closest(".MuiFormControl-root") || el.closest(".MuiSelect-root");
      const hiddenInput =
        container?.querySelector('input[aria-hidden="true"]') ||
        container?.querySelector(".MuiSelect-nativeInput");

      return {
        value: hiddenInput?.value || el.textContent.trim(),
        type: "muiselect",
        element: el,
      };
    });

    const allInputs = [...regularInputs, ...muiSelects].map((item) => ({
      value: item.value,
      type: item.type,
    }));

    console.log("🔍 發送輸入資料:", allInputs);
    sendResponse(allInputs);
    return true; // 保持消息端口開啟
  } else if (request.action === "fillInputs") {
    const data = request.data;

    // 獲取所有輸入元素（包括 MUI Select）
    const regularInputs = Array.from(document.querySelectorAll("input"));
    const muiSelects = Array.from(
      document.querySelectorAll(".MuiSelect-select")
    );
    const allInputs = [...regularInputs, ...muiSelects];

    data.forEach((item, idx) => {
      if (allInputs[idx]) {
        const val = item.value || item;
        fillInputSmart(allInputs[idx], val);
      }
    });

    sendResponse({ success: true });
    return true; // 保持消息端口開啟
  } else if (request.action === "clearInputs") {
    const inputs = document.querySelectorAll("input");

    inputs.forEach((input, index) => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    sendResponse({ success: true, clearedCount: inputs.length });
    return true; // 保持消息端口開啟
  } else {
    console.log("🔍 未知的消息類型:", request.action);
  }

  return false; // 對於未知的消息類型，不保持端口開啟
});

console.log("✅ content script injected");

function fillInputSmart(input, value) {
  if (!input) return;

  const tag = input.tagName.toLowerCase();
  const type = input.getAttribute("type");
  const role = input.getAttribute("role");
  const className = input.className || "";

  const useNativeSetter = (proto, key) => {
    return Object.getOwnPropertyDescriptor(proto, key)?.set;
  };
  // console.log("fillInputSmart", { tag, type, role, value, className });

  try {
    // 檢查是否為 MUI Select
    if (
      className.includes("MuiSelect-select") ||
      className.includes("MuiInputBase-input")
    ) {
      console.log("🔍 檢測到 MUI Select，嘗試處理...");
      // simulateMUISelectInput(input, value);
      return;
    }

    if (
      tag === "input" &&
      (type === "text" ||
        type === "email" ||
        type === "number" ||
        type === "password" ||
        !type)
    ) {
      const setter = useNativeSetter(HTMLInputElement.prototype, "value");
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (tag === "textarea") {
      const setter = useNativeSetter(HTMLTextAreaElement.prototype, "value");
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (tag === "input" && (type === "checkbox" || type === "radio")) {
      input.checked = Boolean(value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (tag === "select") {
      const setter = useNativeSetter(HTMLSelectElement.prototype, "value");
      setter.call(input, value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (role === "combobox") {
      simulateMUIAutocompleteInput(input, value);
    } else {
      console.warn("Unrecognized input type. Skipped:", input);
    }
  } catch (err) {
    console.error("Error setting input:", input, err);
  }
}

function simulateMUISelectInput(selectElement, valueToSelect) {
  console.log("🔍 開始處理 MUI Select，目標值:", valueToSelect);
  try {
    // 方法 1: 找到隱藏的原生 input 並直接設值
    const container =
      selectElement.closest(".MuiFormControl-root") ||
      selectElement.closest(".MuiSelect-root");
    if (container) {
      // 尋找隱藏的原生 input (通常有 value 屬性)
      const hiddenInput =
        container.querySelector('input[aria-hidden="true"]') ||
        container.querySelector(".MuiSelect-nativeInput");

      if (hiddenInput) {
        console.log("🔍 找到隱藏的 input，當前值:", hiddenInput.value);
        console.log("🔍 目標值:", valueToSelect);

        // 先嘗試直接設定值
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set;
        if (setter) {
          setter.call(hiddenInput, valueToSelect);

          // 觸發多種事件確保 React 檢測到變化
          hiddenInput.dispatchEvent(new Event("input", { bubbles: true }));
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));

          // 也對顯示元素觸發事件
          selectElement.dispatchEvent(new Event("change", { bubbles: true }));

          console.log("✅ 方法1: 直接設定隱藏 input 的值完成");

          // 檢查是否設定成功
          setTimeout(() => {
            if (hiddenInput.value === valueToSelect) {
              console.log("✅ 值設定成功確認");
            } else {
              console.log("⚠️ 值設定可能未生效，嘗試方法2");
            }
          }, 100);
          return;
        }
      }
    }

  } catch (error) {
    console.error("🔍 處理 MUI Select 時發生錯誤:", error);
  }

  // 等待選單出現
  setTimeout(() => {
    // 尋找打開的選單
    const menu =
      document.querySelector('[role="listbox"]') ||
      document.querySelector(".MuiMenu-paper") ||
      document.querySelector(".MuiPopover-paper");

    if (!menu) {
      console.warn("🔍 無法找到 MUI Select 的選單");
      return;
    }

    console.log("🔍 找到選單:", menu);

    // 尋找匹配的選項
    const options =
      menu.querySelectorAll('[role="option"]') ||
      menu.querySelectorAll(".MuiMenuItem-root");

    console.log("🔍 找到選項數量:", options.length);

    const matchedOption = [...options].find((opt) => {
      const text = opt.textContent.trim();
      console.log("🔍 檢查選項:", text, "vs", valueToSelect);
      return text === valueToSelect || text.includes(valueToSelect);
    });

    if (matchedOption) {
      console.log("🔍 找到匹配的選項，點擊:", matchedOption.textContent);
      matchedOption.click();
      console.log("✅ 成功點擊 MUI Select 選項");
    } else {
      console.warn(
        "🔍 找不到匹配的選項，可用選項:",
        [...options].map((opt) => opt.textContent.trim())
      );
      // 嘗試按 Escape 關閉選單
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    }
  }, 300); // 增加等待時間確保選單完全載入
}

function simulateMUIAutocompleteInput(inputElement, valueToSelect) {
  console.log({ valueToSelect });

  // 1. 讓 input 聚焦
  inputElement.focus();

  // 2. 填入文字，觸發 onInput
  inputElement.value = valueToSelect;
  inputElement.dispatchEvent(new Event("input", { bubbles: true }));

  // 3. 等待 Autocomplete 建立選單後點擊第一個匹配項
  setTimeout(() => {
    // 找出出現的 Popper 選單
    const listbox = document.querySelector('[role="listbox"]');
    if (!listbox) {
      console.warn("找不到 Autocomplete 的 listbox");
      return;
    }

    // 選擇第一個選項（或你可以用 textContent 去比對）
    const options = listbox.querySelectorAll('[role="option"]');
    const matchedOption = [...options].find((opt) =>
      opt.textContent.trim().includes(valueToSelect)
    );

    if (matchedOption) {
      matchedOption.click(); // 模擬選擇
    } else {
      console.warn("找不到符合的選項");
    }
  }, 200); // 要等一下 Popper 渲染（視具體情況調整）
}






function processMenuOptions(menu, valueToSelect) {
  console.log("🔍 找到選單:", menu);

  // 尋找匹配的選項
  const options =
    menu.querySelectorAll('[role="option"]') ||
    menu.querySelectorAll(".MuiMenuItem-root") ||
    menu.querySelectorAll("li");

  console.log("🔍 找到選項數量:", options.length);

  // 記錄所有可用選項
  const availableOptions = [...options].map((opt) => ({
    text: opt.textContent.trim(),
    value:
      opt.getAttribute("data-value") ||
      opt.getAttribute("value") ||
      opt.textContent.trim(),
    element: opt,
  }));

  console.log("🔍 可用選項:", availableOptions);

  // 嘗試多種匹配方式
  let matchedOption = availableOptions.find(
    (opt) =>
      opt.value === valueToSelect ||
      opt.text === valueToSelect ||
      opt.element.getAttribute("data-value") === valueToSelect
  );

  if (!matchedOption) {
    // 如果直接匹配失敗，嘗試模糊匹配
    matchedOption = availableOptions.find(
      (opt) =>
        opt.text.includes(valueToSelect) || valueToSelect.includes(opt.text)
    );
  }

  if (matchedOption) {
    console.log("🔍 找到匹配的選項，點擊:", matchedOption);
    matchedOption.element.click();
    console.log("✅ 成功點擊 MUI Select 選項");
  } else {
    console.warn("🔍 找不到匹配的選項");
    console.warn("🔍 目標值:", valueToSelect);
    console.warn(
      "🔍 可用選項:",
      availableOptions.map((opt) => `${opt.text} (value: ${opt.value})`)
    );

    // 嘗試按 Escape 關閉選單
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  }
}
