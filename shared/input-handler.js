// shared/input-handler.js
// Input 相關處理邏輯

function getAllInputs() {
  const getInputsFromDocument = (doc) => {
    return Array.from(doc.querySelectorAll("input"))
      .filter((el) => el.type !== "hidden")
      .map((el) => el);
  };

  const regularInputs = getInputsFromDocument(document);

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

function fillInputSmart(input, value) {
  console.log({ input, value });
  if (!input || !value || typeof value !== "string" || value.includes("Object"))
    return;

  const tag = input.tagName.toLowerCase();
  const type = input.getAttribute("type");
  const role = input.getAttribute("role");

  const useNativeSetter = (proto, key) => {
    return Object.getOwnPropertyDescriptor(proto, key)?.set;
  };

  try {
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
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (tag === "textarea") {
      const setter = useNativeSetter(HTMLTextAreaElement.prototype, "value");
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (tag === "input" && (type === "checkbox" || type === "radio")) {
      const cb = document.querySelector(`input[type="checkbox"][value="${value}"]`);
      if (cb) {
        cb.checked = true;
        cb.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else if (tag === "select") {
      const setter = useNativeSetter(HTMLSelectElement.prototype, "value");
      setter.call(input, value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      console.warn("Unrecognized input type. Skipped:", input);
    }
  } catch (err) {
    console.error("Error setting input:", input, err);
  }
}

function loadTestDataToInputs(data) {
  const allInputs = getAllInputs();

  data.forEach((item, idx) => {
    if (allInputs[idx]) {
      const val = item.value || item;
      if (typeof val === "string") {
        console.log(`載入測試資料: ${val} -> input[${idx}]`);
        fillInputSmart(allInputs[idx], val);
      }
    }
  });

  // 觸發關閉選單的事件
  setTimeout(() => {
    const evt = new MouseEvent("click", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(evt);
  }, 100);
}