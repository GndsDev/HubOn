CREATE TABLE cash_shifts (
    id BIGSERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    opened_by_user_id BIGINT NOT NULL,
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    closed_by_user_id BIGINT,
    closed_at TIMESTAMP,
    expected_cash NUMERIC(12, 2),
    counted_cash NUMERIC(12, 2),
    difference_amount NUMERIC(12, 2),
    closing_note VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cash_shifts_opened_by_user
        FOREIGN KEY (opened_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_cash_shifts_closed_by_user
        FOREIGN KEY (closed_by_user_id) REFERENCES users(id),
    CONSTRAINT chk_cash_shifts_status
        CHECK (status IN ('OPEN', 'CLOSED')),
    CONSTRAINT chk_cash_shifts_opening_balance
        CHECK (opening_balance >= 0),
    CONSTRAINT chk_cash_shifts_closing_values
        CHECK (
            (status = 'OPEN' AND closed_by_user_id IS NULL AND closed_at IS NULL
                AND expected_cash IS NULL AND counted_cash IS NULL AND difference_amount IS NULL)
            OR
            (status = 'CLOSED' AND closed_by_user_id IS NOT NULL AND closed_at IS NOT NULL
                AND expected_cash IS NOT NULL AND counted_cash IS NOT NULL AND difference_amount IS NOT NULL)
        )
);

CREATE UNIQUE INDEX uq_cash_shifts_single_open
ON cash_shifts (status)
WHERE status = 'OPEN';

CREATE INDEX idx_cash_shifts_opened_at
ON cash_shifts (opened_at DESC);

ALTER TABLE payments
ADD COLUMN cash_shift_id BIGINT;

ALTER TABLE payments
ADD CONSTRAINT fk_payments_cash_shift
FOREIGN KEY (cash_shift_id) REFERENCES cash_shifts(id) ON DELETE SET NULL;

CREATE INDEX idx_payments_cash_shift_time
ON payments (cash_shift_id, paid_at);

CREATE TABLE cash_movements (
    id BIGSERIAL PRIMARY KEY,
    cash_shift_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    note VARCHAR(500) NOT NULL,
    created_by_user_id BIGINT NOT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cash_movements_shift
        FOREIGN KEY (cash_shift_id) REFERENCES cash_shifts(id),
    CONSTRAINT fk_cash_movements_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    CONSTRAINT chk_cash_movements_type
        CHECK (type IN ('SUPPLY', 'WITHDRAWAL')),
    CONSTRAINT chk_cash_movements_amount
        CHECK (amount > 0)
);

CREATE INDEX idx_cash_movements_shift_time
ON cash_movements (cash_shift_id, occurred_at);

CREATE INDEX idx_payments_paid_at
ON payments (paid_at);
