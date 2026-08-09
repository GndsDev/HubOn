package com.hubon.backend.sale.repository;

import com.hubon.backend.sale.domain.SaleItemOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface SaleItemOptionRepository extends JpaRepository<SaleItemOption, Long> {
    List<SaleItemOption> findAllBySaleItemIdInOrderByIdAsc(Collection<Long> saleItemIds);
}
