# Order Creation Before Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the order on checkout submit and make PIX/card steps purely informational so a final click is no longer required to save a paid order.

**Architecture:** Keep order creation in `submitPedido` as-is, but move cart clearing and step transitions so the order is created before payment UI. PIX close just closes the modal; card submit can still advance to the success screen without creating the order.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, Vitest, Testing Library.

---

## File Structure (planned changes)
- Modify: `src/components/checkout/CheckoutModal.tsx` to clear cart right after a successful order submit and adjust PIX/card transitions.
- Modify: `src/components/checkout/PixPayment.tsx` to make the button a pure close action (rename label optional).
- Create: `src/components/checkout/CheckoutModal.test.tsx` to validate order creation timing and PIX close behavior.

---

### Task 1: Add failing checkout flow test

**Files:**
- Create: `src/components/checkout/CheckoutModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CheckoutModal from './CheckoutModal';
import { useCartStore } from '../../store/cart';
import type { ItemCarrinho } from '../../types';

const submitPedidoMock = vi.fn();

vi.mock('../../hooks/useCheckout', () => ({
  useCheckout: () => ({
    submitPedido: submitPedidoMock,
  }),
}));

vi.mock('../../lib/mercadopago', () => ({
  loadMercadoPago: vi.fn(),
}));

beforeEach(() => {
  submitPedidoMock.mockResolvedValue({
    success: true,
    pedido: { id: 123 },
  });

  const item: ItemCarrinho = {
    id: 1,
    cartKey: '1',
    nome: 'Produto Teste',
    marca: 'Marca',
    categoria: 'Cat',
    preco: 100,
    imagem: null,
    estoque: 10,
    qtd: 1,
  };

  useCartStore.setState({ items: [item] });
});

describe('CheckoutModal', () => {
  it('creates order on submit and clears cart before PIX step', async () => {
    const onClose = vi.fn();
    render(<CheckoutModal onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: 'Cliente Teste' },
    });
    fireEvent.change(screen.getByLabelText(/WhatsApp/i), {
      target: { value: '(11) 99999-9999' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar pedido/i }));

    await waitFor(() => {
      expect(submitPedidoMock).toHaveBeenCalledTimes(1);
    });

    expect(useCartStore.getState().items).toHaveLength(0);
    expect(screen.getByText(/Pagamento via PIX/i)).toBeInTheDocument();
  });

  it('closes modal from PIX step without resubmitting', async () => {
    const onClose = vi.fn();
    render(<CheckoutModal onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: 'Cliente Teste' },
    });
    fireEvent.change(screen.getByLabelText(/WhatsApp/i), {
      target: { value: '(11) 99999-9999' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar pedido/i }));

    await waitFor(() => {
      expect(screen.getByText(/Pagamento via PIX/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Fechar pagamento PIX/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(submitPedidoMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk pnpm run test -- CheckoutModal.test.tsx`

Expected: FAIL because the cart is not cleared on submit and PIX close does not match the expected behavior.

- [ ] **Step 3: Commit**

```bash
rtk git add src/components/checkout/CheckoutModal.test.tsx
rtk git commit -m "test: add checkout submit flow expectations"
```

---

### Task 2: Clear cart on submit and decouple PIX close

**Files:**
- Modify: `src/components/checkout/CheckoutModal.tsx`
- Modify: `src/components/checkout/PixPayment.tsx`

- [ ] **Step 1: Update submit flow to clear cart before payment steps**

Replace the success block in `handleSubmit` with:

```tsx
    setPedidoId(result.pedido?.id ?? null);
    setTxid(`AG${Date.now()}`);
    clearCart();

    if (pagamento === 'pix') {
      setStep('pix');
    } else if (pagamento === 'cartao') {
      try {
        const mp = await loadMercadoPago();
        setMpInstance(mp);
        setStep('card');
      } catch {
        setSubmitError('Não foi possível carregar o módulo de pagamento. Tente novamente.');
      }
    } else {
      setStep('success');
    }
```

- [ ] **Step 2: Make PIX close just close the modal**

Update the PIX render branch in `CheckoutModal` to remove cart clearing and success transition:

```tsx
        {step === 'pix' && (
          <>
            <div className={styles.body}>
              <PixPayment total={total} txid={txid} onClose={onClose} />
            </div>
          </>
        )}
```

- [ ] **Step 3: Remove cart clearing from card token handler**

Update the card branch to only advance to success:

```tsx
        {step === 'card' && mpInstance && (
          <>
            <div className={styles.body}>
              <h3 className={styles.headTitle} style={{ marginBottom: 8 }}>Pagamento com <em>Cartao</em></h3>
              <p className={styles.headSub} style={{ marginBottom: 20 }}>Total: {fmt(total)}</p>
              <CardPaymentSafe amount={total} mp={mpInstance} onTokenReceived={() => { setStep('success'); }} />
            </div>
          </>
        )}
```

- [ ] **Step 4: Rename the PIX button label to reflect close-only behavior**

In `PixPayment`, update the button text and keep the `aria-label` for tests:

```tsx
      <button
        type="button"
        aria-label="Fechar pagamento PIX"
        onClick={onClose}
        style={{ width: '100%', padding: '1rem', background: '#c9a961', color: '#0a0a0a', border: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2 }}
      >
        Fechar
      </button>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `rtk pnpm run test -- CheckoutModal.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/checkout/CheckoutModal.tsx src/components/checkout/PixPayment.tsx
rtk git commit -m "feat: create order before payment steps"
```

