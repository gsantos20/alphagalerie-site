# Order creation before payment (design)

Date: 2026-05-11

## Context
Today the order is effectively created only after the user clicks a second button in the payment step (ex: PIX QR screen). This creates risk of paid orders not being registered if the user never clicks that final button.

## Goals
- Create the order at the moment the customer submits the checkout form.
- Make PIX/card steps only display payment instructions and not be responsible for creating orders.
- Reduce risk of losing paid orders due to missing final click.

## Non-goals
- No webhook-based payment confirmation in this change.
- No changes to payment providers or backend schema.

## Proposed flow (recommended)
1) User fills checkout form and clicks "Confirmar pedido".
2) App validates inputs and creates the order immediately (status: pendente).
3) If creation succeeds:
   - Clear cart.
   - Move to PIX or card step to show payment instructions.
4) If creation fails:
   - Stay on form with error message.
5) The PIX/card "Concluir" button only closes the modal (optional rename to "Fechar").

## UX details
- The success of order creation is required to enter PIX/card steps.
- PIX step continues to show QR and key; user can close the modal when done.
- Card step continues to show card form; submitting the card form is not responsible for creating the order.

## Data and state handling
- Keep the same payload for `submitPedido` and create the order once.
- `clearCart()` should be called immediately after successful order creation.
- `pedidoId` should be set from the creation response and shown on success screen when applicable.
- Status remains `pendente` until manual confirmation outside this flow.

## Error handling
- If `submitPedido` fails, show the existing error and do not advance.
- If payment SDK fails to load after order creation, show an error and allow retry or close; the order still exists.

## Affected areas
- Checkout modal step logic for submit and transitions.
- PIX and card close actions.
- Copy for the close button (optional).

## Testing
- Unit tests for checkout flow: order created on form submit, not on PIX/card close.
- Manual smoke: create order, go to PIX, close modal, ensure order exists.

## Open questions
- Should the close button label be "Concluir" or "Fechar"?
