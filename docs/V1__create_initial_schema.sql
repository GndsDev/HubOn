CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id)
        REFERENCES roles(id)
);

CREATE TABLE restaurant_tables (
    id BIGSERIAL PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    name VARCHAR(80),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_restaurant_tables_status
        CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'DISABLED'))
);

CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255),
    price NUMERIC(10, 2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    image_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id),

    CONSTRAINT chk_products_price
        CHECK (price >= 0)
);

CREATE TABLE tabs (
    id BIGSERIAL PRIMARY KEY,
    restaurant_table_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    opened_by_user_id BIGINT NOT NULL,
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    service_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    final_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tabs_restaurant_table
        FOREIGN KEY (restaurant_table_id)
        REFERENCES restaurant_tables(id),

    CONSTRAINT fk_tabs_opened_by_user
        FOREIGN KEY (opened_by_user_id)
        REFERENCES users(id),

    CONSTRAINT chk_tabs_status
        CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),

    CONSTRAINT chk_tabs_amounts
        CHECK (
            total_amount >= 0
            AND service_fee >= 0
            AND discount_amount >= 0
            AND final_amount >= 0
        )
);

CREATE UNIQUE INDEX uq_tabs_one_open_per_table
ON tabs (restaurant_table_id)
WHERE status = 'OPEN';

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    tab_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CREATED',
    type VARCHAR(30) NOT NULL DEFAULT 'TABLE',
    created_by_user_id BIGINT NOT NULL,
    notes VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_orders_tab
        FOREIGN KEY (tab_id)
        REFERENCES tabs(id),

    CONSTRAINT fk_orders_created_by_user
        FOREIGN KEY (created_by_user_id)
        REFERENCES users(id),

    CONSTRAINT chk_orders_status
        CHECK (status IN (
            'CREATED',
            'SENT_TO_KITCHEN',
            'PREPARING',
            'READY',
            'DELIVERED',
            'CANCELLED'
        )),

    CONSTRAINT chk_orders_type
        CHECK (type IN ('TABLE', 'COUNTER', 'TAKEAWAY'))
);

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    product_name_snapshot VARCHAR(120) NOT NULL,
    unit_price_snapshot NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    notes VARCHAR(500),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    subtotal NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id),

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id),

    CONSTRAINT chk_order_items_quantity
        CHECK (quantity > 0),

    CONSTRAINT chk_order_items_values
        CHECK (
            unit_price_snapshot >= 0
            AND subtotal >= 0
        ),

    CONSTRAINT chk_order_items_status
        CHECK (status IN ('ACTIVE', 'CANCELLED'))
);

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    tab_id BIGINT NOT NULL,
    method VARCHAR(30) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_by_user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_payments_tab
        FOREIGN KEY (tab_id)
        REFERENCES tabs(id),

    CONSTRAINT fk_payments_received_by_user
        FOREIGN KEY (received_by_user_id)
        REFERENCES users(id),

    CONSTRAINT chk_payments_method
        CHECK (method IN (
            'CASH',
            'CREDIT_CARD',
            'DEBIT_CARD',
            'PIX',
            'VOUCHER'
        )),

    CONSTRAINT chk_payments_amount
        CHECK (amount > 0)
);