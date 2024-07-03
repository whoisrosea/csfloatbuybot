const axios = require("axios");

const API_KEY = "CXhSmYc1ttBFLXOGBTHnxOFNdU0WkRZy";

const headers = {
  Authorization: API_KEY,
};

let knownListingsIds = new Set();

const { Builder, By, until } = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const path = require("path");

async function fetchBuffPrice(id) {
  const profilePath = path.join(
    "/Users/whoisrosea/Library/Application Support/Firefox/Profiles/78yboywm.default-release"
  );

  let options = new firefox.Options();
  options.setProfile(profilePath);

  let driver = await new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(options)
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
    const price = listing.price;
    const float = parseFloat(listing.item.float_value);
    const name = listing.item.item_name;

    if (float < 0.01 && price > 200 && listing.type === "buy_now") {
      try {
        const buffPrice = await fetchBuffPrice(listing.id);
        const sign = buffPrice.charAt(0);
        const numericBuffPrice =
          price + parseFloat(buffPrice.replace(/[\+\-$]/g, ""));
        const percentage = 100 - (price / numericBuffPrice) * 100;

        if (percentage > 10 && sign === "-") {
          console.log('filtered', listing.id);
          filteredListings.push(listing);
        }
      } catch (error) {
        console.error(`Error fetching Buff price for ${name}:`, error);
      }
    }
  }

  return filteredListings;
}

async function fetchAndCompareListings() {
  const listings = await fetchSortedListings();
  const newListings = compareNewListings(listings);
  const filteredListings = await filterListings(newListings);
  console.log("filteredListings.length =", filteredListings.length);
}

function startFetchingListings() {
  setInterval(fetchAndCompareListings, 20000);
}

startFetchingListings();
