package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.InventoryMovement;
import com.hubon.backend.stock.domain.InventoryMovementOriginType;
import com.hubon.backend.stock.domain.InventoryMovementType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, Long> {

    @EntityGraph(attributePaths = {"ingredient", "user", "order", "orderItem"})
    List<InventoryMovement> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = {"ingredient", "user", "order", "orderItem"})
    List<InventoryMovement> findAllByIngredientIdOrderByCreatedAtDesc(Long ingredientId, Pageable pageable);

    @EntityGraph(attributePaths = {"ingredient", "user", "order", "orderItem"})
    List<InventoryMovement> findAllByTypeOrderByCreatedAtDesc(InventoryMovementType type, Pageable pageable);

    @EntityGraph(attributePaths = {"ingredient", "user", "order", "orderItem"})
    List<InventoryMovement> findAllByOrderIdAndOriginTypeAndTypeOrderByCreatedAtAsc(
            Long orderId,
            InventoryMovementOriginType originType,
            InventoryMovementType type
    );

    boolean existsByIngredientIdAndOrderItemIdAndOriginTypeAndType(
            Long ingredientId,
            Long orderItemId,
            InventoryMovementOriginType originType,
            InventoryMovementType type
    );
}
