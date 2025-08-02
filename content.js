chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getInputs") {
    const inputs = Array.from(document.querySelectorAll("input")).map(el => ({
      value: el.value,
      type: el.type || "text"
    }));
    sendResponse(inputs);
  } else if (request.action === "fillInputs") {
    const data = request.data;
    const inputs = document.querySelectorAll("input");
    data.forEach((item, idx) => {
      if (inputs[idx]) inputs[idx].value = item.value || item;
    });
  }
});
