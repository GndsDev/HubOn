ALTER TABLE tabs
ADD COLUMN table_number INTEGER;

UPDATE tabs tab
SET table_number = restaurant_table.number
FROM restaurant_tables restaurant_table
WHERE tab.restaurant_table_id = restaurant_table.id
  AND tab.type = 'TABLE'
  AND tab.table_number IS NULL;

ALTER TABLE tabs
DROP CONSTRAINT chk_tabs_origin;

ALTER TABLE tabs
ADD CONSTRAINT chk_tabs_origin
CHECK (
    (
        type = 'TABLE'
        AND table_number IS NOT NULL
        AND table_number > 0
    )
    OR
    (
        type = 'COUNTER'
        AND restaurant_table_id IS NULL
        AND table_number IS NULL
    )
);

CREATE UNIQUE INDEX uq_tabs_one_open_table_number
ON tabs (table_number)
WHERE type = 'TABLE'
  AND status = 'OPEN'
  AND table_number IS NOT NULL;
