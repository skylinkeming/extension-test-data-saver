chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getInputs") {
    const inputs = Array.from(document.querySelectorAll("input")).map((el) => ({
      value: el.value,
      type: el.type || "text",
    }));
    sendResponse(inputs);
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

    sendResponse({ success: true });
  } else if (request.action === "clearInputs") {
    const inputs = document.querySelectorAll("input");
    console.log("清除所有輸入欄位");
    inputs.forEach((input) => {
      console.log(input);
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    sendResponse({ success: true });
  }

  return true;
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
