## Spider swap returns and handles spilage in BPS (basis points)

- Slippage in basis points is 100 = 1%
- To calculate slippage percentage from basis points (100 basis points = 1%)... we did this
  ```js
  const slippagePercent = (slippageBps / 100).toFixed(1);
  ```
