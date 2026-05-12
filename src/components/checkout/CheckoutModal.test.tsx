import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('./PixPayment', () => ({
  default: ({ onClose }: { onClose: () => void }) => {
    if (useCartStore.getState().items.length !== 0) {
      throw new Error('Cart not cleared before PixPayment render');
    }

    return (
      <div>
        <div>Pagamento via PIX</div>
        <button type="button" aria-label="Fechar pagamento PIX" onClick={onClose}>
          Fechar
        </button>
      </div>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
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

afterEach(() => {
  useCartStore.setState({ items: [] });
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

    await waitFor(() => {
      expect(screen.getByText(/Pagamento via PIX/i)).toBeInTheDocument();
    });
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

    await screen.findByText(/Pagamento via PIX/i);

    fireEvent.click(screen.getByRole('button', { name: /Fechar pagamento PIX/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(submitPedidoMock).toHaveBeenCalledTimes(1);
  });
});
