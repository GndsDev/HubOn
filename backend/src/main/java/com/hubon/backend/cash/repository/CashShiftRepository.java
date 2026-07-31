package com.hubon.backend.cash.repository;

import com.hubon.backend.cash.domain.CashShift;
import com.hubon.backend.cash.domain.CashShiftStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CashShiftRepository extends JpaRepository<CashShift, Long> {

    @EntityGraph(attributePaths = {"openedByUser", "closedByUser"})
    Optional<CashShift> findFirstByStatus(CashShiftStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select shift from CashShift shift where shift.status = :status")
    Optional<CashShift> findByStatusForUpdate(@Param("status") CashShiftStatus status);

    @EntityGraph(attributePaths = {"openedByUser", "closedByUser"})
    List<CashShift> findAllByOrderByOpenedAtDesc(Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"openedByUser", "closedByUser"})
    @Query("select shift from CashShift shift where shift.id = :id")
    Optional<CashShift> findByIdForUpdate(@Param("id") Long id);
}
