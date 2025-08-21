// shared/testdataHoverManager.js - 修復版本

class TestDataHoverManager {
  constructor() {
    this.testDataButton = null;
    this.testDataDropdown = null;
    this.currentHoveredInput = null;
    this.hideTimer = null;
    this.isInitialized = false;

    this.BUTTON_STYLES = this.getButtonStyles();
    this.DROPDOWN_STYLES = this.getDropdownStyles();

    // 🔧 修復：預先綁定事件處理器，避免重複綁定問題
    this.boundMouseOverHandler = this.handleMouseOver.bind(this);
    this.boundMouseOutHandler = this.handleMouseOut.bind(this);
    this.boundScrollHandler = this.updateButtonPosition.bind(this);
    this.boundResizeHandler = this.updateButtonPosition.bind(this);
  }

  async init() {
    if (this.isInitialized) {
      console.log("懸停監聽器已初始化，跳過重複初始化");
      return;
    }

    this.cleanup();
    this.bindEventListeners();
    this.isInitialized = true;
    console.log("✅ 懸停監聽器已初始化（事件委派）");
  }

  cleanup() {
    this.removeEventListeners();
    this.removeElements();
    clearTimeout(this.hideTimer);
    this.isInitialized = false;
    console.log("✅ 懸停監聽器已清理");
  }

  bindEventListeners() {
    // 🔧 修復：使用預先綁定的處理器
    document.addEventListener("mouseover", this.boundMouseOverHandler);
    document.addEventListener("mouseout", this.boundMouseOutHandler);
    window.addEventListener("scroll", this.boundScrollHandler, {
      passive: true,
    });
    window.addEventListener("resize", this.boundResizeHandler, {
      passive: true,
    });
  }

  removeEventListeners() {
    // 🔧 修復：使用相同的函數引用來移除事件監聽器
    document.removeEventListener("mouseover", this.boundMouseOverHandler);
    document.removeEventListener("mouseout", this.boundMouseOutHandler);
    window.removeEventListener("scroll", this.boundScrollHandler);
    window.removeEventListener("resize", this.boundResizeHandler);
  }

  removeElements() {
    if (this.testDataButton) {
      this.testDataButton.remove();
      this.testDataButton = null;
    }

    if (this.testDataDropdown) {
      this.testDataDropdown.remove();
      this.testDataDropdown = null;
    }
  }

  async handleMouseOver(e) {
    const target = e.target;

    if (this.isTestDataButton(target)) {
      this.handleButtonHover(target);
      return;
    }

    if (this.isTestDataDropdown(target)) {
      this.clearHideTimer();
      return;
    }

    if (this.isValidInput(target)) {
      await this.handleInputHover(target);
    }
  }

  handleMouseOut(e) {
    const target = e.target;
    const relatedTarget = e.relatedTarget;

    if (this.isTestDataButton(target)) {
      this.handleButtonLeave(target, relatedTarget);
    } else if (this.isTestDataDropdown(target)) {
      this.handleDropdownLeave(relatedTarget);
    } else if (this.isValidInput(target)) {
      this.handleInputLeave(relatedTarget);
    }
  }

  isTestDataButton(element) {
    return element && element.id === "test-data-button";
  }

  isTestDataDropdown(element) {
    return (
      element &&
      (element.id === "test-data-dropdown" ||
        element.closest("#test-data-dropdown"))
    );
  }

  isValidInput(element) {
    return (
      element &&
      element.tagName &&
      element.tagName.toLowerCase() === "input" &&
      element.type !== "hidden"
    );
  }

  async handleButtonHover(target) {
    // console.log("🔍 按鈕懸停事件");
    this.clearHideTimer();
    this.setButtonHoverStyle(target);
    await this.showDropdown();
  }

  handleButtonLeave(target, relatedTarget) {
    // console.log("🔍 按鈕離開事件", { relatedTarget });
    this.setButtonNormalStyle(target);

    // 🔧 修復：改善離開邏輯，檢查是否真的離開了按鈕區域
    if (!this.isMovingToDropdown(relatedTarget)) {
      this.scheduleHide();
    }
  }

  handleDropdownLeave(relatedTarget) {
    // console.log("🔍 下拉選單離開事件", { relatedTarget });
    if (!this.isMovingToButton(relatedTarget)) {
      this.scheduleHide();
    }
  }

  async handleInputHover(target) {
    this.clearHideTimer();
    const testData = await this.getTestDataForCurrentPage();
    if (testData.length > 0) {
      this.showButton(target);
    }
  }

  handleInputLeave(relatedTarget) {
    if (!this.isMovingToTestDataElements(relatedTarget)) {
      this.scheduleHide();
    }
  }

  // 🔧 新增：輔助方法來檢查滑鼠移動方向
  isMovingToDropdown(relatedTarget) {
    return this.isTestDataDropdown(relatedTarget);
  }

  isMovingToButton(relatedTarget) {
    return this.isTestDataButton(relatedTarget);
  }

  isMovingToTestDataElements(relatedTarget) {
    return (
      this.isTestDataButton(relatedTarget) ||
      this.isTestDataDropdown(relatedTarget)
    );
  }

  async getTestDataForCurrentPage() {
    const currentInputCount = getAllInputs().length;
    return await findMatchingTestData(window.location.href, currentInputCount);
  }

  showButton(input) {
    const button = this.createButton();
    const position = this.calculateButtonPosition(input);

    this.setButtonPosition(button, position);
    this.showElement(button);
    this.currentHoveredInput = input;

    // console.log(`按鈕位置: left=${position.left}, top=${position.top}`);
  }

  createButton() {
    if (this.testDataButton) return this.testDataButton;

    this.testDataButton = document.createElement("div");
    this.testDataButton.id = "test-data-button";
    this.testDataButton.style.cssText = this.BUTTON_STYLES;
    this.testDataButton.textContent = "📋 帶入測試資料";

    document.body.appendChild(this.testDataButton);
    return this.testDataButton;
  }

  async showDropdown() {
    const testData = await this.getTestDataForCurrentPage();
    if (testData.length === 0) return;

    const dropdown = this.createDropdown();
    this.populateDropdown(dropdown, testData);
    this.positionDropdown(dropdown);
    this.showElement(dropdown);
  }

  createDropdown() {
    if (this.testDataDropdown) return this.testDataDropdown;

    this.testDataDropdown = document.createElement("div");
    this.testDataDropdown.id = "test-data-dropdown";
    this.testDataDropdown.style.cssText = this.DROPDOWN_STYLES;

    document.body.appendChild(this.testDataDropdown);
    return this.testDataDropdown;
  }

  populateDropdown(dropdown, testData) {
    dropdown.innerHTML = "";
    dropdown.appendChild(this.createDropdownTitle());

    testData.forEach((item, index) => {
      const option = this.createDropdownOption(item, index, testData.length);
      dropdown.appendChild(option);
    });
  }

  createDropdownTitle() {
    const title = document.createElement("div");
    title.style.cssText = `
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      color: #2c3e50;
      border-bottom: 1px solid #e9ecef;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 8px 8px 0 0;
    `;
    title.textContent = "選擇要載入的測試資料";
    return title;
  }

  createDropdownOption(item, index, totalItems) {
    const option = document.createElement("div");
    option.style.cssText = this.getOptionStyles(index, totalItems);

    const tagName = this.createTagNameElement(item);
    const pageInfo = this.createPageInfoElement(item);

    option.appendChild(tagName);
    option.appendChild(pageInfo);

    this.bindOptionEvents(option, item);
    return option;
  }

  createTagNameElement(item) {
    const tagName = document.createElement("div");
    tagName.style.cssText = `
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 2px;
    `;
    tagName.textContent = `📝 ${item.tag}`;
    return tagName;
  }

  createPageInfoElement(item) {
    const pageInfo = document.createElement("div");
    pageInfo.style.cssText = `
      font-size: 11px;
      color: #6c757d;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
    `;
    const matchTypeText = item.matchType === "strict" ? "嚴格匹配" : "寬鬆匹配";
    pageInfo.textContent = `${item.pageTitle} [${matchTypeText}]`;
    return pageInfo;
  }

  bindOptionEvents(option, item) {
    option.addEventListener("mouseenter", () => {
      option.style.background =
        "linear-gradient(135deg, #e8f4f0 0%, #d1eddf 100%)";
    });

    option.addEventListener("mouseleave", () => {
      option.style.background = "transparent";
    });

    option.addEventListener("click", () => {
      loadTestDataToInputs(item.data);
      this.hideElements();
    });
  }

  calculateButtonPosition(input) {
    const rect = input.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top - 35,
    };
  }

  setButtonPosition(button, position) {
    button.style.left = `${position.left}px`;
    button.style.top = `${position.top}px`;
  }

  positionDropdown(dropdown) {
    if (!this.testDataButton) return;

    const buttonRect = this.testDataButton.getBoundingClientRect();
    dropdown.style.left = `${buttonRect.left}px`;
    dropdown.style.top = `${buttonRect.bottom}px`;
  }

  showElement(element) {
    element.style.display = "block";
    element.style.opacity = "1";
  }

  hideElements() {
    this.clearHideTimer();

    if (this.testDataButton) {
      this.testDataButton.style.display = "none";
      this.testDataButton.style.opacity = "0";
    }

    if (this.testDataDropdown) {
      this.testDataDropdown.style.display = "none";
    }

    this.currentHoveredInput = null;
  }

  updateButtonPosition() {
    if (!this.shouldUpdatePosition()) return;

    const input = this.currentHoveredInput;
    const rect = input.getBoundingClientRect();

    if (this.isInputHidden(rect)) {
      this.hideElements();
      return;
    }

    const position = this.calculateButtonPosition(input);
    this.setButtonPosition(this.testDataButton, position);
  }

  shouldUpdatePosition() {
    return (
      this.testDataButton &&
      this.currentHoveredInput &&
      this.testDataButton.style.display !== "none"
    );
  }

  isInputHidden(rect) {
    return rect.width === 0 && rect.height === 0;
  }

  setButtonHoverStyle(button) {
    button.style.background =
      "linear-gradient(135deg, #7fb8a8 0%, #388e6c 100%)";
    button.style.transform = "translateY(-1px)";
  }

  setButtonNormalStyle(button) {
    button.style.background =
      "linear-gradient(135deg, #8ec2b5 0%, #4e9e94 100%)";
    button.style.transform = "translateY(0)";
  }

  clearHideTimer() {
    clearTimeout(this.hideTimer);
  }

  scheduleHide() {
    // console.log("🔍 安排隱藏按鈕 (300ms 後)");
    this.hideTimer = setTimeout(() => {
      //   console.log("🔍 執行隱藏按鈕");
      this.hideElements();
    }, 300);
  }

  getButtonStyles() {
    return `
      position: fixed;
      z-index: 9999;
      background: linear-gradient(135deg, #8ec2b5 0%, #4e9e94 100%);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      user-select: none;
      pointer-events: auto;
      transition: all 0.2s ease;
      white-space: nowrap;
      display: none;
    `;
  }

  getDropdownStyles() {
    return `
      position: fixed;
      z-index: 10000;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border: 1px solid #e0e0e0;
      max-height: 300px;
      overflow-y: auto;
      min-width: 200px;
      max-width: 400px;
      user-select: none;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: none;
    `;
  }

  getOptionStyles(index, totalItems) {
    return `
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: ${index < totalItems - 1 ? "1px solid #f0f0f0" : "none"};
      transition: background 0.2s ease;
      font-size: 13px;
    `;
  }
}
