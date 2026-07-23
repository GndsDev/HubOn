CREATE TABLE ingredients (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255),
    unit VARCHAR(30) NOT NULL,
    current_stock NUMERIC(15, 3) NOT NULL DEFAULT 0,
    minimum_stock NUMERIC(15, 3) NOT NULL DEFAULT 0,
    ideal_stock NUMERIC(15, 3) NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_ingredients_unit
        CHECK (unit IN ('KG', 'G', 'L', 'ML', 'UN', 'CX', 'PACKAGE', 'TRAY')),

    CONSTRAINT chk_ingredients_stock_amounts
        CHECK (
            current_stock >= 0
            AND minimum_stock >= 0
            AND ideal_stock >= 0
            AND ideal_stock >= minimum_stock
        )
);

CREATE UNIQUE INDEX uq_ingredients_name_lower
ON ingredients (lower(name));

CREATE INDEX idx_ingredients_active_name
ON ingredients (active, name);

CREATE INDEX idx_ingredients_stock_alerts
ON ingredients (active, current_stock, minimum_stock);

CREATE TABLE inventory_movements (
    id BIGSERIAL PRIMARY KEY,
    ingredient_id BIGINT NOT NULL,
    type VARCHAR(30) NOT NULL,
    quantity NUMERIC(15, 3) NOT NULL,
    previous_stock NUMERIC(15, 3) NOT NULL,
    resulting_stock NUMERIC(15, 3) NOT NULL,
    reason VARCHAR(500),
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventory_movements_ingredient
        FOREIGN KEY (ingredient_id)
        REFERENCES ingredients(id),

    CONSTRAINT fk_inventory_movements_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    CONSTRAINT chk_inventory_movements_type
        CHECK (type IN ('ENTRY', 'EXIT', 'LOSS', 'ADJUSTMENT', 'REVERSAL')),

    CONSTRAINT chk_inventory_movements_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_inventory_movements_stock_amounts
        CHECK (
            previous_stock >= 0
            AND resulting_stock >= 0
        )
);

CREATE INDEX idx_inventory_movements_ingredient_created_at
ON inventory_movements (ingredient_id, created_at DESC);

CREATE INDEX idx_inventory_movements_type_created_at
ON inventory_movements (type, created_at DESC);

CREATE INDEX idx_inventory_movements_user_created_at
ON inventory_movements (user_id, created_at DESC);

CREATE INDEX idx_inventory_movements_created_at
ON inventory_movements (created_at DESC);

CREATE TABLE product_ingredients (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    ingredient_id BIGINT NOT NULL,
    quantity NUMERIC(15, 3) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product_ingredients_product
        FOREIGN KEY (product_id)
        REFERENCES products(id),

    CONSTRAINT fk_product_ingredients_ingredient
        FOREIGN KEY (ingredient_id)
        REFERENCES ingredients(id),

    CONSTRAINT uq_product_ingredients_product_ingredient
        UNIQUE (product_id, ingredient_id),

    CONSTRAINT chk_product_ingredients_quantity
        CHECK (quantity > 0)
);

CREATE INDEX idx_product_ingredients_product
ON product_ingredients (product_id);

CREATE INDEX idx_product_ingredients_ingredient
ON product_ingredients (ingredient_id);
