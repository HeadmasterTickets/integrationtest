This is a basic [Next.js](https://nextjs.org) ticket-site starter for BeMyGuest integration testing.

## Getting Started

1) Install dependencies:

```bash
npm install
```

2) Create your local env file:

```bash
cp .env.local.example .env.local
```

3) Update `.env.local` with BeMyGuest + Stripe keys:

```env
BMG_API_BASE=https://api.demo.bemyguest.com.sg
BMG_API_KEY=your_demo_api_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_CHECKOUT_SUCCESS_PATH=/checkout/success
STRIPE_CHECKOUT_CANCEL_PATH=/checkout/cancel
STRIPE_CURRENCY=sgd
```

4) Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Task 1 page

- Product list homepage: `/`
- Published Product 1 page: `/products/product-1`
- Cart: `/cart`

The Product 1 page fetches data server-side from:

- `GET /v2/products/{uuid}`
- `GET /v2/products/{uuid}/product-types`

If the key is missing or invalid, the page shows an API error box with setup instructions.

## Stripe linking step

After creating Stripe products/prices, link each BeMyGuest pair to Stripe in:

- `src/lib/stripe-catalog.js`

Fill `STRIPE_PRICE_MAP` values with Stripe `price_...` IDs.
