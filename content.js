chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("🔍 Content script 收到消息:", request);
  
  if (request.action === "getInputs") {
    const inputs = Array.from(document.querySelectorAll("input")).map((el) => ({
      value: el.value,
      type: el.type || "text",
    }));
    console.log("🔍 發送輸入資料:", inputs);
    sendResponse(inputs);
    return true; // 保持消息端口開啟
  } else if (request.action === "fillInputs") {
    const data = request.data;
    const inputs = document.querySelectorAll("input");

    data.forEach((item, idx) => {
      if (inputs[idx]) {
        console.log("input:");
        console.log(inputs[idx]);
        inputs[idx].value = item.value;

        const val = item.value || item;

        fillInputSmart(inputs[idx], val);
      }
    });

    console.log("🔍 填入完成");
    sendResponse({ success: true });
    return true; // 保持消息端口開啟
  } else if (request.action === "clearInputs") {
    console.log("🔍 開始清除所有輸入欄位");
    const inputs = document.querySelectorAll("input");
    console.log("🔍 找到的輸入欄位數量:", inputs.length);
    
    inputs.forEach((input, index) => {
      console.log(`🔍 清除第 ${index + 1} 個輸入欄位:`, input);
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    
    console.log("🔍 清除完成，發送回應");
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

  const useNativeSetter = (proto, key) => {
    return Object.getOwnPropertyDescriptor(proto, key)?.set;
  };
  console.log("fillInputSmart", { tag, type, role, value });

  try {
    if (
      tag === "input" &&
      (type === "text" ||
        type === "email" ||
        type === "number" ||
        type === "password" ||
        !type)
    ) {
      console.log("input type:" + type + " value: " + value);
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

function simulateMUIAutocompleteInput(inputElement, valueToSelect) {
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
      opt.textContent.trim().includes(valueToSelect),
    );

    if (matchedOption) {
      matchedOption.click(); // 模擬選擇
    } else {
      console.warn("找不到符合的選項");
    }
  }, 200); // 要等一下 Popper 渲染（視具體情況調整）
}
