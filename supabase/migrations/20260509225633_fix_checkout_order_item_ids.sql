-- Migration: Fix checkout order item IDs for numeric catalog schema
-- Description: Recreates create_order_with_items using BIGINT product and variation IDs
-- Date: 2026-05-09
-- Status: Safe - replaces existing function definition

CREATE OR REPLACE FUNCTION create_order_with_items(
	p_numero TEXT,
	p_cliente_nome TEXT,
	p_cliente_whatsapp TEXT,
	p_cliente_email TEXT DEFAULT NULL,
	p_cliente_endereco TEXT DEFAULT NULL,
	p_forma_pagamento TEXT DEFAULT 'pix',
	p_tipo_entrega TEXT DEFAULT 'sedex',
	p_observacoes TEXT DEFAULT NULL,
	p_subtotal NUMERIC DEFAULT 0,
	p_total NUMERIC DEFAULT 0,
	p_itens JSONB DEFAULT '[]'::jsonb
) RETURNS jsonb AS $$
DECLARE
	v_pedido_id UUID;
	v_item JSONB;
	v_error_msg TEXT;
BEGIN
	IF p_numero IS NULL OR p_numero = '' THEN
		RETURN jsonb_build_object('error', 'Order number required', 'code', 'INVALID_NUMERO');
	END IF;

	IF p_cliente_nome IS NULL OR p_cliente_nome = '' THEN
		RETURN jsonb_build_object('error', 'Customer name required', 'code', 'INVALID_NOME');
	END IF;

	IF EXISTS (SELECT 1 FROM pedidos WHERE numero = p_numero) THEN
		RETURN jsonb_build_object('error', 'Order number already exists', 'code', 'DUPLICATE_NUMERO');
	END IF;

	BEGIN
		INSERT INTO pedidos (
			numero, cliente_nome, cliente_whatsapp, cliente_email,
			cliente_endereco, forma_pagamento, tipo_entrega,
			observacoes, subtotal, total, status
		) VALUES (
			p_numero,
			p_cliente_nome,
			p_cliente_whatsapp,
			NULLIF(p_cliente_email, ''),
			p_cliente_endereco,
			p_forma_pagamento,
			p_tipo_entrega,
			p_observacoes,
			p_subtotal,
			p_total,
			'pendente'
		)
		RETURNING id INTO v_pedido_id;

		INSERT INTO pedido_itens (
			pedido_id, produto_id, produto_nome, produto_codigo,
			quantidade, preco_unitario, subtotal, variacao_id, created_at
		)
		SELECT 
			v_pedido_id,
			(item->>'produto_id')::BIGINT,
			item->>'produto_nome',
			item->>'produto_codigo',
			(item->>'quantidade')::INTEGER,
			(item->>'preco_unitario')::NUMERIC,
			(item->>'subtotal')::NUMERIC,
			CASE 
				WHEN item->>'variacao_id' = 'null' OR item->>'variacao_id' = '' 
				THEN NULL 
				ELSE (item->>'variacao_id')::BIGINT 
			END,
			NOW()
		FROM jsonb_array_elements(p_itens) AS item
		WHERE item->>'produto_nome' IS NOT NULL;

		RETURN jsonb_build_object(
			'success', true,
			'id', v_pedido_id,
			'numero', p_numero,
			'status', 'pendente',
			'created_at', NOW()::text,
			'total_items', (SELECT count(*) FROM pedido_itens WHERE pedido_id = v_pedido_id)
		);

	EXCEPTION WHEN OTHERS THEN
		v_error_msg := SQLERRM;
		RETURN jsonb_build_object(
			'success', false,
			'error', v_error_msg,
			'code', SQLSTATE,
			'hint', 'Check FK constraints and data types'
		);
	END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_order_with_items TO anon, authenticated, service_role;
