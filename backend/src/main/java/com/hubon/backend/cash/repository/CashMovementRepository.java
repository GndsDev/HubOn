package com.hubon.backend.cash.repository;

import com.hubon.backend.cash.domain.CashMovement;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CashMovementRepository extends JpaRepository<CashMovement, Long> {

    @EntityGraph(attributePaths = {"createdByUser"})
    List<CashMovement> findAllByCashShiftIdOrderByOccurredAtAsc(Long cashShiftId);
}
