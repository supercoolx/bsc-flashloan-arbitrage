# Binance smart chain flashloan arbitrage bot (AlmaZeus)

Bot written in TS that uses flashswaps of Pancakeswap on BSC network.

## How to use

1. Install node_modules
    ```
    npm install
    ```
2. Rename `.env.example` file to `.env`.
3. Config `.env` file.

    You need to use private key of your wallet.

    You can get `COINMARKETCAP_KEY` key on [pro.coinmarketcap.com](https://pro.coinmarketcap.com/).

4. Run bot.

    - Mainnet
    ```
    npm start wbnb busd
    npm start busd wbnb cake
    npm run 1inch wbnb busd
    ```
    - Testnet
    ```
    npm run test wbnb busd
    ```

5. Find oppotunity.
    - Find two pair.

    ```
    npm run find wbnb *
    ```
    - You can change swap order like this.
    ```
    npm run find * wbnb
    ```
    - Find three pair.
    ```
    npm run find wbnb busd *
    npm run find wbnb * *
    npm run find * wbnb *
    ...
    ```

You can add more tokens in `/src/config/tokens.json`.

You can change flashswap contract address in `/src/config/address.json`.
```json
{
    "mainnet": {
        "flashSwap": "FlashSwap contract address here",
        ...
    },
    "testnet": {
        "flashSwap": "FlashSwap contract address here",
        ...
    }
}
```