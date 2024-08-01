const axios = require("axios");

const API_KEY = "CXhSmYc1ttBFLXOGBTHnxOFNdU0WkRZy";

const headers = {
  Authorization: API_KEY,
};

const stickersNames = [
  "Sticker | Titan (Foil) | Cluj-Napoca 2015",
  "Sticker | Titan (Foil) | Cologne 2015",
  "Sticker | Titan (Holo) | Cologne 2014",
  "Sticker | Titan (Holo) | Katowice 2015",
  "Sticker | Titan | Cluj-Napoca 2015",
  "Sticker | Titan | Cologne 2014",
  "Sticker | Titan | Cologne 2015",
  "Sticker | Titan | Katowice 2015",
  "Sticker | iBUYPOWER (Holo) | Cologne 2014",
  "Sticker | iBUYPOWER | Cologne 2014",
  "Sticker | iBUYPOWER | DreamHack 2014",
];

let knownListingsIds = new Set();

const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const path = require("path");

async function fetchBuffPrice(id) {
  const extensionPath = path.resolve("./extensions/betterFloat.crx");
  let options = new chrome.Options();
  options.addExtensions(extensionPath);

  options.addArguments("--headless");
  options.addArguments("--disable-gpu");

  let driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  try {
    await driver.get("https://csfloat.com/search?sort_by=most_recent");

    let xpath = `//item-card[contains(@data-betterfloat, '"id":"${id}"')]`;

    let itemElement = await driver.wait(
      until.elementLocated(By.xpath(xpath)),
      20000
    ); // Ждем до 20 секунд

    if (itemElement) {
      console.log("Element found.");
    } else {
      console.log("Element not found.");
    }

    let buffPriceElement = await driver.findElement(
      By.css("span.betterfloat-sale-tag")
    );
    return await buffPriceElement.getText();
  } catch (error) {
    console.error("Error finding item:", error);
    return "-$0.00";
  } finally {
    await driver.quit();
  }
}

function compareNewListings(currentListings) {
  if (knownListingsIds.size === 0) {
    currentListings.forEach((ad) => knownListingsIds.add(ad.id));
    return currentListings;
  } else {
    const newAds = currentListings.filter((ad) => !knownListingsIds.has(ad.id));
    newAds.forEach((ad) => knownListingsIds.add(ad.id));
    return newAds;
  }
}

const fetchSortedListings = async () => {
  const params = {
    sort_by: "most_recent",
  };
  const config = { headers, params };
  const url = "https://csfloat.com/api/v1/listings?limit=40";

  try {
    const response = await axios.get(url, config);
    return response.data;
  } catch (error) {
    console.error("Ошибка при запросе всех обьявлений", error);
    return [];
  }
};

async function filterListings(listings) {
  const filteredListings = [];

  for (const listing of listings) {
    let isCandidateValid = false;
    const stickers = listing.item.stickers;
    const price = listing.price;
    const float = parseFloat(listing.item.float_value);
    const name = listing.item.item_name;
    if (
      float < 0.01 &&
      price > 200 &&
      price < 10000 &&
      listing.type === "buy_now"
    ) {
      try {
        const buffPrice = await fetchBuffPrice(listing.id);
        const sign = buffPrice.charAt(0);
        const numericBuffPrice =
          price + parseFloat(buffPrice.replace(/[\+\-$]/g, ""));
        const percentage = 100 - (price / numericBuffPrice) * 100;
        if (percentage > 10 && sign === "-") {
          filteredListings.push(listing);
          isCandidateValid = true;
        }
      } catch (error) {
        console.error(`Error fetching Buff price for ${name}:`, error);
      }
    }
    if (stickers && !isCandidateValid) {
      for (const sticker of stickers) {
        for (const stickerName of stickersNames) {
          if (stickerName === sticker.name && sticker.slot !== 4) {
            const buffPrice = await fetchBuffPrice(listing.id);
            const sign = buffPrice.charAt(0);
            const numericBuffPrice =
              price + parseFloat(buffPrice.replace(/[\+\-$]/g, ""));
            const percentage = 100 - (price / numericBuffPrice) * 100;
            // console.log("candidate buffPrice", buffPrice);
            // console.log("percent", percentage);
            if (percentage >= 0 && sign === "-") {
              filteredListings.push(listing);
            }
          }
        }
      }
    }
  }

  return filteredListings;
}

async function buyFilteredListings(listings) {
  const buyUrl = "https://csfloat.com/api/v1/listings/buy";

  for (const listing of listings) {
    try {
      const payload = {
        total_price: listing.price,
        contract_ids: [listing.id],
      };

      const config = {
        headers: {
          Authorization: "CXhSmYc1ttBFLXOGBTHnxOFNdU0WkRZy",
        },
      };

      const response = await axios.post(buyUrl, payload, config);

      console.log(
        `Listing ${listing.id} processed successfully`,
        response.data
      );
    } catch (error) {
      console.error(`Error processing listing ${listing.id}`, error);
    }
  }
}

async function fetchAndCompareListings() {
  const listings = await fetchSortedListings();
  const newListings = compareNewListings(listings);
  const filteredListings = await filterListings(newListings);
  // console.log("////////////////////////");
  if (filteredListings.length > 0) {
    console.log("filteredListings.length =", filteredListings);
  }
  // await buyFilteredListings(filteredListings);
}

function startFetchingListings() {
  setInterval(fetchAndCompareListings, 20000);
}

startFetchingListings();
