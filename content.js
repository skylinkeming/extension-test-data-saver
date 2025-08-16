chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("🔍 Content script 收到消息:", request);

  if (request.action === "getInputs") {
    // 抓取一般的 input 元素

    const allInputs = getAllInputs().map((item) => ({
      value: item.value,
      type: item.type,
    }));

    console.log("🔍 發送輸入資料:", allInputs);
    sendResponse(allInputs);
    return true; // 保持消息端口開啟
  } else if (request.action === "fillInputs") {
    const data = request.data;

    const allInputs = getAllInputs();

    data.forEach((item, idx) => {
      if (allInputs[idx]) {
        const val = item.value || item;
        if (typeof val === "string") {
          console.log({ 要填的值: val, input: allInputs[idx] });
          fillInputSmart(allInputs[idx], val);
        }
      }
    });

    setTimeout(() => {
      console.log("🔍 模擬點擊 document.body 用來關閉Material UI等套件觸發的選單");
      const evt = new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(evt);

      const evt2 = new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(evt2);

      const evt3 = new MouseEvent("click", { bubbles: true, cancelable: true });
      document.body.dispatchEvent(evt3);
    }, 100);

    sendResponse({ success: true });
    return true; // 保持消息端口開啟
  } else if (request.action === "clearInputs") {
    const inputs = getAllInputs();

    inputs.forEach((input, index) => {
      if (input instanceof HTMLInputElement) {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (isElementInIframe(input)) {
        // 如果不是，則檢查它是否來自 iframe
        handleIframeInput(input);
      } else {
        console.warn(`跳过无效的 input 元素:`, input);
      }
    });

    sendResponse({ success: true, clearedCount: inputs.length });
    return true; // 保持消息端口開啟
  } else {
    console.log("🔍 未知的消息類型:", request.action);
  }

  return false; // 對於未知的消息類型，不保持端口開啟
});

console.log("✅ content script injected");

//資料填入input中
function fillInputSmart(input, value) {
  console.log({ input, value });
  if (!input || !value) return;

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
    // if (
    //   className.includes("MuiSelect-select") ||
    //   className.includes("MuiInputBase-input")
    // ) {
    //   console.log("🔍 檢測到 MUI Select，嘗試處理...");
    //   // simulateMUISelectInput(input, value);
    //   return;
    // }

    if (
      tag === "input" &&
      (type === "text" ||
        type === "email" ||
        type === "number" ||
        type === "password" ||
        !type)
    ) {
      // 
      const setter = useNativeSetter(HTMLInputElement.prototype, "value");
      setter.call(input, value);
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      // input.dispatchEvent(new Event("blur", { bubbles: true }));
      input.blur();
    } else if (tag === "textarea") {
      const setter = useNativeSetter(HTMLTextAreaElement.prototype, "value");
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (tag === "input" && (type === "checkbox" || type === "radio")) {
      // input.checked = Boolean(value);
      // input.dispatchEvent(new Event("change", { bubbles: true }));

      const cb = document.querySelector(
        `input[type="checkbox"][value="${value}"]`,
      );

      if (cb) {
        cb.checked = true; // 改 UI 狀態
        cb.dispatchEvent(new Event("change", { bubbles: true })); // 觸發原生事件
      }
    } else if (tag === "select") {
      const setter = useNativeSetter(HTMLSelectElement.prototype, "value");
      setter.call(input, value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      console.log("3rd road value:" + value);
    } else if (role === "combobox") {
      // simulateMUIAutocompleteInput(input, value);
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
          "value",
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
}

function simulateMUIAutocompleteInput(inputElement, valueToSelect) {
  console.log({ valueToSelect });

  // 1. 讓 input 聚焦
  inputElement.focus();

  // 2. 填入文字，觸發 onInput
  inputElement.value = valueToSelect;
  inputElement.dispatchEvent(new Event("input", { bubbles: true }));

  // 3. 等待 Autocomplete 建立選單後點擊第一個匹配項
  // setTimeout(() => {
  //   // 找出出現的 Popper 選單
  //   const listbox = document.querySelector('[role="listbox"]');
  //   if (!listbox) {
  //     console.warn("找不到 Autocomplete 的 listbox");
  //     return;
  //   }

  //   // 選擇第一個選項（或你可以用 textContent 去比對）
  //   const options = listbox.querySelectorAll('[role="option"]');
  //   const matchedOption = [...options].find((opt) =>
  //     opt.textContent.trim().includes(valueToSelect)
  //   );

  //   if (matchedOption) {
  //     // matchedOption.click(); // 模擬選擇
  //   } else {
  //     console.warn("找不到符合的選項");
  //   }
  // }, 200); // 要等一下 Popper 渲染（視具體情況調整）
}

function getAllInputs() {
  const getInputsFromDocument = (doc) => {
    return Array.from(doc.querySelectorAll("input"))
      .filter((el) => el.type !== "hidden") // 过滤掉隐藏的 input
      .map((el) => el); // 确保返回的是 DOM 元素本身
  };

  const regularInputs = getInputsFromDocument(document);

  // 遍歷所有 iframe，抓取其中的 input 元素
  const iframeInputs = Array.from(document.querySelectorAll("iframe"))
    .map((iframe) => {
      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow.document;
        return getInputsFromDocument(iframeDoc);
      } catch (e) {
        console.warn("无法访问 iframe 内容:", iframe, e);
        return [];
      }
    })
    .flat();

  console.log("🔍 获取到的 inputs:", [...regularInputs, ...iframeInputs]);

  return [...regularInputs, ...iframeInputs];
}

// 這個函數用來判斷一個元素是否屬於 iframe
function isElementInIframe(element) {
  // 檢查元素是否有 ownerDocument，並且該文件是否有 defaultView
  // 且該 view 不等於當前的 window
  return (
    element.ownerDocument?.defaultView &&
    element.ownerDocument.defaultView !== window
  );
}

// 處理 iframe 元素的函數
function handleIframeInput(input) {
  try {
    // 取得 iframe 元素的 window 物件
    const iframeWindow = input.ownerDocument.defaultView;
    if (!iframeWindow) {
      console.warn("無法取得 iframe 的 window 物件");
      return;
    }

    // 在 iframe 的 window 中建立 Event
    const inputEvent = new iframeWindow.Event("input", { bubbles: true });

    // 清空 input 的值
    input.value = "";

    // 觸發事件
    input.dispatchEvent(inputEvent);
    console.log("成功在 iframe 中觸發 input 事件:", input);
  } catch (e) {
    console.error("處理 iframe 內的 input 元素時發生錯誤:", e);
  }
}
