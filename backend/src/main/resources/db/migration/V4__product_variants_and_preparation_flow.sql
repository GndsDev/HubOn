ALTER TABLE products
ADD COLUMN preparation_flow VARCHAR(30) NOT NULL DEFAULT 'KITCHEN';

ALTER TABLE products
ADD CONSTRAINT chk_products_preparation_flow
CHECK (preparation_flow IN ('KITCHEN', 'DIRECT_SERVICE'));

ALTER TABLE products
ALTER COLUMN price DROP NOT NULL;

CREATE UNIQUE INDEX uq_products_category_name_ci
ON products (category_id, lower(name));

CREATE TABLE product_variants (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    sku VARCHAR(80),
    price NUMERIC(10, 2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_variants_product
        FOREIGN KEY (product_id)
        REFERENCES products(id),

    CONSTRAINT chk_product_variants_price
        CHECK (price >= 0)
);

INSERT INTO product_variants (
    product_id,
    name,
    price,
    active,
    created_at,
    updated_at
)
SELECT
    id,
    'Padrão',
    coalesce(price, 0),
    active,
    created_at,
    updated_at
FROM products;

CREATE UNIQUE INDEX uq_product_variants_product_name_ci
ON product_variants (product_id, lower(name));

CREATE INDEX idx_product_variants_product
ON product_variants (product_id);

CREATE INDEX idx_product_variants_active
ON product_variants (active);

ALTER TABLE order_items
ADD COLUMN product_variant_id BIGINT,
ADD COLUMN product_variant_name_snapshot VARCHAR(120);

UPDATE order_items item
SET
    product_variant_id = variant.id,
    product_variant_name_snapshot = variant.name
FROM product_variants variant
WHERE variant.product_id = item.product_id
  AND variant.name = 'Padrão';

ALTER TABLE order_items
ALTER COLUMN product_variant_id SET NOT NULL,
ALTER COLUMN product_variant_name_snapshot SET NOT NULL;

ALTER TABLE order_items
ADD CONSTRAINT fk_order_items_product_variant
FOREIGN KEY (product_variant_id)
REFERENCES product_variants(id);

CREATE INDEX idx_order_items_product_variant
ON order_items (product_variant_id);

ALTER TABLE product_stock_links
ADD COLUMN product_variant_id BIGINT;

UPDATE product_stock_links link
SET product_variant_id = variant.id
FROM product_variants variant
WHERE variant.product_id = link.product_id
  AND variant.name = 'Padrão';

ALTER TABLE product_stock_links
ALTER COLUMN product_variant_id SET NOT NULL,
ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE product_stock_links
ADD CONSTRAINT fk_product_stock_links_product_variant
FOREIGN KEY (product_variant_id)
REFERENCES product_variants(id);

DROP INDEX IF EXISTS uq_product_stock_links_active_product;

CREATE UNIQUE INDEX uq_product_stock_links_active_variant
ON product_stock_links (product_variant_id)
WHERE active = TRUE;

CREATE INDEX idx_product_stock_links_product_variant
ON product_stock_links (product_variant_id);
