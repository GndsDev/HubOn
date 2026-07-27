ALTER TABLE ingredients
ADD COLUMN control_mode VARCHAR(30) NOT NULL DEFAULT 'MANUAL';

ALTER TABLE ingredients
ADD CONSTRAINT chk_ingredients_control_mode
CHECK (control_mode IN ('MANUAL', 'DIRECT_SALE'));

ALTER TABLE inventory_movements
ADD COLUMN origin_type VARCHAR(40),
ADD COLUMN origin_reference VARCHAR(120),
ADD COLUMN order_id BIGINT,
ADD COLUMN order_item_id BIGINT;

ALTER TABLE inventory_movements
ADD CONSTRAINT fk_inventory_movements_order
FOREIGN KEY (order_id)
REFERENCES orders(id);

ALTER TABLE inventory_movements
ADD CONSTRAINT fk_inventory_movements_order_item
FOREIGN KEY (order_item_id)
REFERENCES order_items(id);

ALTER TABLE inventory_movements
ADD CONSTRAINT chk_inventory_movements_origin_type
CHECK (origin_type IS NULL OR origin_type IN ('MANUAL', 'ORDER_ITEM', 'ORDER_CANCELLATION'));

CREATE INDEX idx_inventory_movements_order_created_at
ON inventory_movements (order_id, created_at DESC);

CREATE INDEX idx_inventory_movements_order_item
ON inventory_movements (order_item_id);

CREATE UNIQUE INDEX uq_inventory_movements_order_item_exit
ON inventory_movements (ingredient_id, order_item_id)
WHERE origin_type = 'ORDER_ITEM'
  AND type = 'EXIT'
  AND order_item_id IS NOT NULL;

CREATE UNIQUE INDEX uq_inventory_movements_order_item_reversal
ON inventory_movements (ingredient_id, order_item_id)
WHERE origin_type = 'ORDER_CANCELLATION'
  AND type = 'REVERSAL'
  AND order_item_id IS NOT NULL;

CREATE TABLE product_stock_links (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    stock_item_id BIGINT NOT NULL,
    quantity_per_sale NUMERIC(15, 3) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_stock_links_product
        FOREIGN KEY (product_id)
        REFERENCES products(id),

    CONSTRAINT fk_product_stock_links_stock_item
        FOREIGN KEY (stock_item_id)
        REFERENCES ingredients(id),

    CONSTRAINT chk_product_stock_links_quantity
        CHECK (quantity_per_sale > 0)
);

CREATE UNIQUE INDEX uq_product_stock_links_active_product
ON product_stock_links (product_id)
WHERE active = TRUE;

CREATE INDEX idx_product_stock_links_stock_item
ON product_stock_links (stock_item_id);

CREATE INDEX idx_product_stock_links_active
ON product_stock_links (active);

DROP TABLE IF EXISTS product_ingredients;
