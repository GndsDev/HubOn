UPDATE order_items
SET status = 'READY'
WHERE preparation_flow_snapshot = 'DIRECT_SERVICE'
  AND status IN ('WAITING_PREPARATION', 'IN_PREPARATION');

UPDATE orders order_record
SET status = 'READY'
WHERE order_record.status IN ('SENT_TO_KITCHEN', 'PREPARING')
  AND EXISTS (
      SELECT 1
      FROM order_items item
      WHERE item.order_id = order_record.id
        AND item.status = 'READY'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM order_items item
      WHERE item.order_id = order_record.id
        AND item.status IN (
            'DRAFT',
            'WAITING_PREPARATION',
            'IN_PREPARATION'
        )
  );
