ALTER TABLE tabs
ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'TABLE',
ADD COLUMN customer_name VARCHAR(120),
ADD COLUMN customer_phone VARCHAR(30),
ADD COLUMN identification_note VARCHAR(160),
ADD COLUMN closed_business_date DATE;

UPDATE tabs
SET closed_business_date = CAST(closed_at AS DATE)
WHERE closed_at IS NOT NULL;

ALTER TABLE tabs
ALTER COLUMN restaurant_table_id DROP NOT NULL;

ALTER TABLE tabs
ADD CONSTRAINT chk_tabs_type
CHECK (type IN ('TABLE', 'COUNTER')),
ADD CONSTRAINT chk_tabs_origin
CHECK (
    (type = 'TABLE' AND restaurant_table_id IS NOT NULL)
    OR (type = 'COUNTER' AND restaurant_table_id IS NULL)
);

CREATE INDEX idx_tabs_monthly_report
ON tabs (status, closed_business_date, type);

CREATE INDEX idx_orders_tab_status
ON orders (tab_id, status);

CREATE INDEX idx_payments_tab_method
ON payments (tab_id, method);
