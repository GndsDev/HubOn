ALTER TABLE stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_reversed_movement_id_key;

DROP INDEX IF EXISTS uq_stock_movements_sale_per_item;
