package com.hubon.backend.product.repository;

import com.hubon.backend.product.domain.ProductOptionGroup;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductOptionGroupRepository extends JpaRepository<ProductOptionGroup, Long> {

    @EntityGraph(attributePaths = {"product", "options"})
    List<ProductOptionGroup> findAllByProductIdOrderByDisplayOrderAscNameAsc(Long productId);

    @EntityGraph(attributePaths = {"product", "options"})
    List<ProductOptionGroup> findAllByProductIdInOrderByDisplayOrderAscNameAsc(Collection<Long> productIds);

    @EntityGraph(attributePaths = {"product", "options"})
    Optional<ProductOptionGroup> findByIdAndProductId(Long id, Long productId);

    boolean existsByProductIdAndNameIgnoreCase(Long productId, String name);

    boolean existsByProductIdAndNameIgnoreCaseAndIdNot(Long productId, String name, Long id);
}
