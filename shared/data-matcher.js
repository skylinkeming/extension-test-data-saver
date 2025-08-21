// shared/data-matcher.js
// 資料匹配相關的邏輯

// 生成嚴格匹配 key（完整路徑）
function generateStrictMatchKey(url) {
  try {
    const urlObj = new URL(url);
    // 嚴格匹配：包含 hostname + pathname + search（查詢參數）
    return `${urlObj.hostname}${urlObj.pathname}${urlObj.search}`;
  } catch (error) {
    console.error("生成嚴格匹配 key 失敗:", error);
    return null;
  }
}

// 生成寬鬆匹配 key（domain + 最後斜線後到問號前）
function generateLooseMatchKey(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const pathname = urlObj.pathname;

    const lastSlashIndex = pathname.lastIndexOf("/");
    const afterLastSlash = pathname.substring(lastSlashIndex + 1);
    const questionMarkIndex = afterLastSlash.indexOf("?");

    const pathPart =
      questionMarkIndex === -1
        ? afterLastSlash
        : afterLastSlash.substring(0, questionMarkIndex);

    return `${domain}/${pathPart}`;
  } catch (error) {
    console.error("生成寬鬆匹配 key 失敗:", error);
    return null;
  }
}

// 兩階段匹配邏輯
async function findMatchingTestData(currentUrl, currentInputCount) {
  return new Promise((resolve) => {
    const strictMatchKey = generateStrictMatchKey(currentUrl);
    const looseMatchKey = generateLooseMatchKey(currentUrl);

    if (!strictMatchKey || !looseMatchKey) {
      resolve([]);
      return;
    }

    console.log(`🔍 當前頁面 input 數量: ${currentInputCount}`);
    console.log(`🔍 嚴格匹配 key: ${strictMatchKey}`);
    console.log(`🔍 寬鬆匹配 key: ${looseMatchKey}`);

    chrome.storage.local.get(null, (allData) => {
      let matchingData = [];
      let strictMatchFound = false;

      // 第一階段：嚴格匹配 (儲存資料的網址必須跟當前一模一樣 才能顯示)
      Object.keys(allData).forEach((storedUrl) => {
        const storedStrictKey = generateStrictMatchKey(storedUrl);

        if (storedStrictKey === strictMatchKey && storedStrictKey !== null) {
          const urlData = allData[storedUrl];

          Object.keys(urlData).forEach((tag) => {
            if (!tag.startsWith("_")) {
              const testData = urlData[tag];

              if (Array.isArray(testData)) {
                const testDataCount = testData.length;
                const countDifference = Math.abs(
                  testDataCount - currentInputCount
                );

                matchingData.push({
                  tag: tag,
                  data: testData,
                  sourceUrl: storedUrl,
                  pageTitle: urlData._pageTitle || storedUrl,
                  testDataCount: testDataCount,
                  countDifference: countDifference,
                  matchType: "strict",
                });

                console.log(
                  `✅ [嚴格匹配] 找到測試資料: ${tag} (${testDataCount} 筆, 差距: ${countDifference})`
                );
                strictMatchFound = true;
              }
            }
          });
        }
      });

      // 第二階段：只有在嚴格匹配完全找不到資料時，才進行寬鬆匹配
      if (!strictMatchFound) {
        console.log("🔍 嚴格匹配無結果，開始寬鬆匹配...");

        Object.keys(allData).forEach((storedUrl) => {
          const storedLooseKey = generateLooseMatchKey(storedUrl);

          if (storedLooseKey === looseMatchKey && storedLooseKey !== null) {
            const urlData = allData[storedUrl];

            Object.keys(urlData).forEach((tag) => {
              if (!tag.startsWith("_")) {
                const testData = urlData[tag];

                if (Array.isArray(testData)) {
                  const testDataCount = testData.length;
                  const countDifference = Math.abs(
                    testDataCount - currentInputCount
                  );

                  matchingData.push({
                    tag: tag,
                    data: testData,
                    sourceUrl: storedUrl,
                    pageTitle: urlData._pageTitle || storedUrl,
                    testDataCount: testDataCount,
                    countDifference: countDifference,
                    matchType: "loose",
                  });

                  console.log(
                    `✅ [寬鬆匹配] 找到測試資料: ${tag} (${testDataCount} 筆, 差距: ${countDifference})`
                  );
                }
              }
            });
          }
        });
      } else {
        console.log("🔍 嚴格匹配已找到資料，跳過寬鬆匹配");
      }

      // 排序：差距小的排前面
      matchingData.sort((a, b) => {
        if (a.countDifference !== b.countDifference) {
          return a.countDifference - b.countDifference;
        }
        if (a.testDataCount !== b.testDataCount) {
          return b.testDataCount - a.testDataCount;
        }
        return a.tag.localeCompare(b.tag);
      });

      console.log(`🔍 匹配模式: ${strictMatchFound ? "嚴格匹配" : "寬鬆匹配"}`);
      console.log(`🔍 排序後的測試資料:`);
      matchingData.forEach((item, index) => {
        console.log(
          `  ${index + 1}. ${item.tag} (${item.testDataCount} 筆, 差距: ${
            item.countDifference
          }) [${item.matchType}]`
        );
      });

      resolve(matchingData);
    });
  });
}
// 處理重複標籤名稱
function handleDuplicateTags(matchingDataArray) {
  const tagCounts = {};

  return matchingDataArray.map((item) => {
    if (tagCounts[item.tag]) {
      tagCounts[item.tag]++;
      const urlSuffix = item.sourceUrl.split("/").pop().substring(0, 8);
      return {
        ...item,
        tag: `${item.tag}_${urlSuffix}`,
      };
    } else {
      tagCounts[item.tag] = 1;
      return item;
    }
  });
}
