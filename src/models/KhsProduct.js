const Item = require("./Item");
const puppeteer = require('puppeteer')
const config = require('../config.js');

class KhsProduct {

    // KHS redirects any request to the homepage if cookies are not present
    // it appears cookies usually expire 2 hours after generations
    // even the presence of expired cookies will be accepted and avoid a redirect
    // we get around this by updating cookies on every request, and listening for 1 redirect
    static cookies = [];


    /**
     * Searches KHS for product matching given upc
     * Sets this.product
     * Updates KhsProduct.cookies
     * @returns KHS ProductJSON, or null if none were found matching UPC
     */
    static async fetchProduct(upc) {
        let browser
        let productDetailsJSON
        // safely try puppeter
        try {
            browser = await puppeteer.launch(config.puppeteer)

            // create new page if one does not exist
            const pages = await browser.pages()
            const page = pages ? pages[0] : await browser.newPage()

            await page.setUserAgent(config.khs.userAgent);
            await page.setCookie(...KhsProduct.cookies)

            // register listener for product details response
            const detailsReponsePromise = page.waitForResponse(
                config.khs.productDetailsURL
            ).catch(() => { })
            // need this catch so that if no matching items are found
            // i.e., porductGrp is falsey, the subsequent promise rejection
            // of detailsResponsePromise is handled


            // attempt to search for item via upc
            const search_url = config.khs.searchPrefixURL + upc
            await page.goto(search_url)

            // page redirected. Needs updated cookies!
            if (page.url() != search_url) {
                await page.goto(search_url)
            }

            // update cookies
            KhsProduct.cookies = await page.cookies()

            // check that the page contains at least 1 product
            // if it doesn't, no request for product details will be made
            const productQuerySelector = await page.$(config.khs.productQuerySelector)
            if (!productQuerySelector) return null

            // retrieve product details json
            const detailsResponse = await detailsReponsePromise;
            productDetailsJSON = await detailsResponse.json();
        } catch (e) {
            throw e
        } finally {
            await browser.close()
        }


        // ensure matching product was found
        if (
            !Array.isArray(productDetailsJSON) ||
            productDetailsJSON.length == 0 ||
            productDetailsJSON[0].UPC_No != upc
        ) {
            return null
        }

        return productDetailsJSON[0]
    }


    /**
     * Constructs object conforming to Item model and validates the object using Mongoose.
     * Does not create a new item.  
     * Sets this. 
     * @returns Object conforming to Item Mongoose model
     */
    static async validateItem(product) {

        try {
            let specMap = new Map();
            product.AdditionProductSpectList.map(object => specMap.set(object.SpectName, object.SpectValue));
            const itemJSON = {
                name: product.Title + (
                    !Array.isArray(product.TitleSupportList) ? "" :
                        product.TitleSupportList
                            .map(attr => attr.SpectValue ? `, ${attr.SpectValue}` : "")
                            .join("")
                ),
                upc: product.UPC_No,
                category_1: product.NavCategory,
                category_2: product.SecondaryNanoGroupDesc,
                category_3: product.NaviSubSubCat,
                brand: product.SubCategory,
                specifications: specMap,
                features: product.AdditionProductInfoList,
                wholesale_cost: product.Unit_Price,
                standard_price: product.MSRP || product.MAPPrice || product.Unit_Price * 1.5,
            }

            await Item.validate(itemJSON);
            return itemJSON
        } catch (err) {
            throw err
        }
    }

}

module.exports = KhsProduct