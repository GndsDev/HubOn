ALTER TABLE sale_items
    ADD COLUMN removed_at TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN removed_by_user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE sale_items
    ADD CONSTRAINT chk_sale_items_removal CHECK (
        (removed_at IS NULL AND removed_by_user_id IS NULL)
        OR
        (removed_at IS NOT NULL AND removed_at >= created_at AND removed_by_user_id IS NOT NULL)
    ),
    ADD CONSTRAINT chk_sale_items_terminal_state CHECK (
        NOT (cancelled_at IS NOT NULL AND removed_at IS NOT NULL)
    );

DROP INDEX idx_sale_items_active_by_sale;
CREATE INDEX idx_sale_items_active_by_sale
    ON sale_items (sale_id, created_at, id)
    WHERE cancelled_at IS NULL AND removed_at IS NULL;

DROP INDEX idx_sale_items_product_reports;
CREATE INDEX idx_sale_items_product_reports
    ON sale_items (product_id, sale_id)
    WHERE cancelled_at IS NULL AND removed_at IS NULL;

CREATE INDEX idx_sale_items_removed_at
    ON sale_items (removed_at) WHERE removed_at IS NOT NULL;
