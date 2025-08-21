// shared/input-handler.js - 完整修復版本
// Input 相關處理邏輯

function getAllInputs() {
  const getInputsFromDocument = (doc) => {
    return Array.from(doc.querySelectorAll("*"))
      .filter((el) => {
        const tagName = el.tagName.toLowerCase();
        const type = el.type;

        if (
          tagName === "input" ||
          tagName === "select" ||
          tagName === "textarea"
        ) {
          // 🔧 修復：更嚴格的 hidden 類型檢查
          if (type === "hidden" || el.getAttribute("type") === "hidden") {
            console.log("🚫 排除 hidden input:", el);
            return false;
          }
          // 🔧 新增：也排除不可見的輸入
          if (el.style.display === "none" || el.hidden) {
            console.log("🚫 排除不可見 input:", el);
            return false;
          }
          return true;
        }
        return false;
      })
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

  const allInputs = [...regularInputs, ...iframeInputs];

  // 🔧 修改：統計時區分選中和未選中的狀態
  const inputStats = {
    text: allInputs.filter((el) =>
      ["text", "email", "password", "number", ""].includes(el.type || "")
    ).length,
    radio_checked: allInputs.filter((el) => el.type === "radio" && el.checked)
      .length,
    radio_unchecked: allInputs.filter(
      (el) => el.type === "radio" && !el.checked
    ).length,
    checkbox_checked: allInputs.filter(
      (el) => el.type === "checkbox" && el.checked
    ).length,
    checkbox_unchecked: allInputs.filter(
      (el) => el.type === "checkbox" && !el.checked
    ).length,
    select: allInputs.filter((el) => el.tagName.toLowerCase() === "select")
      .length,
    textarea: allInputs.filter((el) => el.tagName.toLowerCase() === "textarea")
      .length,
    other: allInputs.filter(
      (el) =>
        ![
          "text",
          "email",
          "password",
          "number",
          "radio",
          "checkbox",
          "",
        ].includes(el.type || "") &&
        el.tagName.toLowerCase() !== "select" &&
        el.tagName.toLowerCase() !== "textarea"
    ).length,
  };

  console.log("🔍 获取到的 inputs 統計:", inputStats);
  console.log("🔍 总计:", allInputs.length, "个输入元素");
  console.log(
    "🔍 详细列表:",
    allInputs.map(
      (el, index) =>
        `[${index + 1}] ${el.tagName.toLowerCase()}[type="${el.type}"]${
          el.type === "radio" || el.type === "checkbox"
            ? `[checked=${el.checked}][value="${el.value}"]`
            : `[value="${el.value}"]`
        }`
    )
  );

  return allInputs;
}

// 🔧 新增：從 input 元素提取有意義的值
function extractInputValue(input) {
  const tag = input.tagName.toLowerCase();
  const type = input.type || "";

  if (tag === "input" && (type === "radio" || type === "checkbox")) {
    // 🔧 Radio/Checkbox：記錄選中狀態和值
    return {
      value: input.value || (input.checked ? "checked" : ""),
      type: type,
      checked: input.checked,
      name: input.name || null,
    };
  } else {
    // 其他類型：直接返回值
    return {
      value: input.value || "",
      type: type || tag,
      checked: null,
    };
  }
}

// 🔧 統一的填入函數
function fillInputSmart(input, savedData) {
  console.log("填入資料:", { input, savedData });

  if (!input) return;

  const tag = input.tagName.toLowerCase();
  const type = input.getAttribute("type") || "";

  const useNativeSetter = (proto, key) => {
    return Object.getOwnPropertyDescriptor(proto, key)?.set;
  };

  try {
    // 🔧 處理不同的資料格式
    let value, checked;

    if (savedData && typeof savedData === "object") {
      // 新格式：包含 type, checked 等資訊
      value = savedData.value;
      checked = savedData.checked;
    } else {
      // 舊格式：只有字串值
      value = savedData;
      checked = null;
    }

    // 🔧 修改：對於 radio/checkbox 的空值處理
    if (tag === "input" && (type === "radio" || type === "checkbox")) {
      // Radio/Checkbox 的特殊處理
      if (savedData && typeof savedData === "object") {
        // 新格式
        if (type === "radio") {
          if (checked && input.value === value) {
            input.checked = true;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            console.log(`✅ 選中 radio: ${input.value}`);
          } else {
            input.checked = false;
            console.log(`⚪ 取消選中 radio: ${input.value}`);
          }
        } else if (type === "checkbox") {
          if (checked !== null) {
            input.checked = checked;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            console.log(
              `✅ 設定 checkbox: ${input.checked ? "選中" : "取消選中"}`
            );
          }
        }
      } else {
        // 舊格式處理
        if (type === "radio") {
          if (input.value === value) {
            input.checked = true;
            input.dispatchEvent(new Event("change", { bubbles: true }));
            console.log(`✅ 選中 radio (舊格式): ${input.value}`);
          } else {
            input.checked = false;
          }
        } else if (type === "checkbox") {
          const shouldCheck =
            value === "true" || value === "checked" || value === input.value;
          input.checked = shouldCheck;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          console.log(
            `✅ 設定 checkbox (舊格式): ${shouldCheck ? "選中" : "取消選中"}`
          );
        }
      }
      return; // 提早返回，避免後續的空值檢查
    }

    // 🔧 對於其他類型的空值檢查
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && (value === "" || value.includes("Object")))
    ) {
      console.log("跳過空值:", savedData);
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
      // 🔧 處理一般文字輸入
      const setter = useNativeSetter(HTMLInputElement.prototype, "value");
      setter.call(input, value);
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      console.log(`✅ 設定文字輸入: ${value}`);
    } else if (tag === "textarea") {
      // 🔧 處理 textarea
      const setter = useNativeSetter(HTMLTextAreaElement.prototype, "value");
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      console.log(`✅ 設定 textarea: ${value}`);
    } else if (tag === "select") {
      // 🔧 處理 select
      const setter = useNativeSetter(HTMLSelectElement.prototype, "value");
      setter.call(input, value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      console.log(`✅ 設定 select: ${value}`);
    } else {
      console.warn("未識別的 input 類型，跳過:", input);
    }
  } catch (err) {
    console.error("設定 input 時發生錯誤:", input, err);
  }
}

function loadTestDataToInputs(data) {
  const allInputs = getAllInputs();

  console.log("🔍 載入測試資料開始:");
  console.log("🔍 輸入元素數量:", allInputs.length);
  console.log("🔍 資料數量:", data.length);

  // 🔧 新增：顯示完整的對應關係
  console.log("🔍 完整對應關係:");
  console.table(
    allInputs.map((input, idx) => ({
      索引: idx + 1,
      標籤: input.tagName.toLowerCase(),
      類型: input.type || "text",
      當前值: input.value || "(空)",
      當前選中: input.checked !== undefined ? input.checked : "N/A",
      儲存資料: data[idx]
        ? typeof data[idx] === "object"
          ? JSON.stringify(data[idx])
          : data[idx]
        : "(無資料)",
    }))
  );

  data.forEach((savedItem, idx) => {
    if (allInputs[idx]) {
      const input = allInputs[idx];

      console.log(`🔍 [${idx + 1}] 開始處理:`, {
        tag: input.tagName.toLowerCase(),
        type: input.type,
        currentValue: input.value,
        currentChecked: input.checked,
        savedData: savedItem,
      });

      fillInputSmart(input, savedItem);

      console.log(`🔍 [${idx + 1}] 處理完成:`, {
        newValue: input.value,
        newChecked: input.checked,
      });
    } else {
      console.warn(`🔍 [${idx + 1}] 找不到對應的輸入元素，資料:`, savedItem);
    }
  });

  // 觸發關閉選單的事件
  setTimeout(() => {
    console.log(
      "🔍 模擬點擊 document.body 用來關閉Material UI等套件觸發的選單"
    );
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
}

// 🔧 新增：獲取所有輸入值（用於儲存）
function getAllInputValues() {
  const allInputs = getAllInputs();

  const inputValues = allInputs
    .filter((input) => {
      // 🔧 雙重檢查：確保沒有 hidden 類型
      const type = input.type || input.getAttribute("type");
      if (type === "hidden") {
        console.log("🚫 在獲取值時排除 hidden input:", input);
        return false;
      }
      return true;
    })
    .map((input, index) => {
      const extractedData = extractInputValue(input);

      console.log(`🔍 [${index + 1}] 提取值:`, {
        tag: input.tagName.toLowerCase(),
        type: input.type,
        currentValue: input.value,
        currentChecked: input.checked,
        extractedData,
      });

      return extractedData;
    });

  console.log("🔍 提取的輸入值總覽:", inputValues);
  return inputValues;
}
