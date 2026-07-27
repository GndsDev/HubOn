ALTER TABLE products
DROP CONSTRAINT chk_products_preparation_flow;

UPDATE products
SET preparation_flow = 'REQUIRES_PREPARATION'
WHERE preparation_flow = 'KITCHEN';

ALTER TABLE products
ALTER COLUMN preparation_flow SET DEFAULT 'REQUIRES_PREPARATION';

ALTER TABLE products
ADD CONSTRAINT chk_products_preparation_flow
CHECK (preparation_flow IN ('REQUIRES_PREPARATION', 'DIRECT_SERVICE'));

ALTER TABLE products
ADD COLUMN available BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE products
ADD CONSTRAINT chk_products_display_order
CHECK (display_order >= 0);

CREATE INDEX idx_products_catalog_order
ON products (active, available, display_order, name);

ALTER TABLE product_variants
ADD COLUMN available BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE product_variants
ADD CONSTRAINT chk_product_variants_display_order
CHECK (display_order >= 0);

CREATE INDEX idx_product_variants_catalog_order
ON product_variants (product_id, active, available, display_order, name);

CREATE TABLE product_option_groups (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    minimum_selections INTEGER NOT NULL DEFAULT 0,
    maximum_selections INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_option_groups_product
        FOREIGN KEY (product_id)
        REFERENCES products(id),

    CONSTRAINT chk_product_option_groups_selections
        CHECK (
            minimum_selections >= 0
            AND maximum_selections >= 1
            AND maximum_selections >= minimum_selections
            AND display_order >= 0
            AND (required = FALSE OR minimum_selections >= 1)
        )
);

CREATE UNIQUE INDEX uq_product_option_groups_product_name_ci
ON product_option_groups (product_id, lower(name));

CREATE INDEX idx_product_option_groups_catalog_order
ON product_option_groups (product_id, active, display_order, name);

CREATE TABLE product_options (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    additional_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_options_group
        FOREIGN KEY (group_id)
        REFERENCES product_option_groups(id),

    CONSTRAINT chk_product_options_values
        CHECK (additional_price >= 0 AND display_order >= 0)
);

CREATE UNIQUE INDEX uq_product_options_group_name_ci
ON product_options (group_id, lower(name));

CREATE INDEX idx_product_options_catalog_order
ON product_options (group_id, active, display_order, name);

ALTER TABLE orders
ADD COLUMN confirmed_at TIMESTAMP,
ADD COLUMN cancellation_reason VARCHAR(500),
ADD COLUMN cancelled_by_user_id BIGINT;

ALTER TABLE orders
ADD CONSTRAINT fk_orders_cancelled_by_user
FOREIGN KEY (cancelled_by_user_id)
REFERENCES users(id);

ALTER TABLE order_items
DROP CONSTRAINT chk_order_items_status;

ALTER TABLE order_items
ADD COLUMN category_name_snapshot VARCHAR(120) NOT NULL DEFAULT 'Sem categoria',
ADD COLUMN preparation_flow_snapshot VARCHAR(30) NOT NULL DEFAULT 'REQUIRES_PREPARATION',
ADD COLUMN cancellation_reason VARCHAR(500),
ADD COLUMN cancelled_at TIMESTAMP,
ADD COLUMN cancelled_by_user_id BIGINT;

UPDATE order_items item
SET
    category_name_snapshot = category.name,
    preparation_flow_snapshot = product.preparation_flow
FROM products product
JOIN categories category ON category.id = product.category_id
WHERE product.id = item.product_id;

UPDATE order_items item
SET status = CASE
    WHEN item.status = 'CANCELLED' OR order_record.status = 'CANCELLED' THEN 'CANCELED'
    WHEN order_record.status = 'CREATED' THEN 'DRAFT'
    WHEN order_record.status = 'SENT_TO_KITCHEN' THEN 'WAITING_PREPARATION'
    WHEN order_record.status = 'PREPARING' THEN 'IN_PREPARATION'
    WHEN order_record.status = 'READY' THEN 'READY'
    WHEN order_record.status = 'DELIVERED' THEN 'DELIVERED'
    ELSE 'DRAFT'
END
FROM orders order_record
WHERE order_record.id = item.order_id;

ALTER TABLE order_items
ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE order_items
ADD CONSTRAINT chk_order_items_status
CHECK (status IN (
    'DRAFT',
    'WAITING_PREPARATION',
    'IN_PREPARATION',
    'READY',
    'DELIVERED',
    'CANCELED'
));

ALTER TABLE order_items
ADD CONSTRAINT chk_order_items_preparation_flow
CHECK (preparation_flow_snapshot IN ('REQUIRES_PREPARATION', 'DIRECT_SERVICE'));

ALTER TABLE order_items
ADD CONSTRAINT fk_order_items_cancelled_by_user
FOREIGN KEY (cancelled_by_user_id)
REFERENCES users(id);

CREATE INDEX idx_order_items_operational_queue
ON order_items (preparation_flow_snapshot, status, created_at);

CREATE TABLE order_item_options (
    id BIGSERIAL PRIMARY KEY,
    order_item_id BIGINT NOT NULL,
    product_option_id BIGINT,
    group_name_snapshot VARCHAR(120) NOT NULL,
    option_name_snapshot VARCHAR(120) NOT NULL,
    additional_price_snapshot NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_item_options_order_item
        FOREIGN KEY (order_item_id)
        REFERENCES order_items(id),

    CONSTRAINT fk_order_item_options_product_option
        FOREIGN KEY (product_option_id)
        REFERENCES product_options(id),

    CONSTRAINT chk_order_item_options_price
        CHECK (additional_price_snapshot >= 0)
);

CREATE INDEX idx_order_item_options_order_item
ON order_item_options (order_item_id);

ALTER TABLE inventory_movements
DROP CONSTRAINT chk_inventory_movements_type;

UPDATE inventory_movements
SET type = 'SALE'
WHERE origin_type = 'ORDER_ITEM'
  AND type = 'EXIT';

ALTER TABLE inventory_movements
ADD CONSTRAINT chk_inventory_movements_type
CHECK (type IN ('ENTRY', 'EXIT', 'LOSS', 'ADJUSTMENT', 'SALE', 'REVERSAL'));

DROP INDEX IF EXISTS uq_inventory_movements_order_item_exit;

CREATE UNIQUE INDEX uq_inventory_movements_order_item_sale
ON inventory_movements (ingredient_id, order_item_id)
WHERE origin_type = 'ORDER_ITEM'
  AND type = 'SALE'
  AND order_item_id IS NOT NULL;

ALTER TABLE product_stock_links
DROP CONSTRAINT fk_product_stock_links_product;

ALTER TABLE product_stock_links
DROP COLUMN product_id;

ALTER TABLE products
DROP CONSTRAINT chk_products_price;

ALTER TABLE products
DROP COLUMN price;
