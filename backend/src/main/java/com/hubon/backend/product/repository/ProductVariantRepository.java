package com.hubon.backend.product.repository;

import com.hubon.backend.product.domain.ProductVariant;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    @EntityGraph(attributePaths = {"product", "product.category"})
    List<ProductVariant> findAllByProductIdOrderByDisplayOrderAscNameAsc(Long productId);

    @EntityGraph(attributePaths = {"product", "product.category"})
    List<ProductVariant> findAllByProductIdInOrderByDisplayOrderAscNameAsc(Collection<Long> productIds);

    @EntityGraph(attributePaths = {"product", "product.category"})
    List<ProductVariant> findAllByProductIdAndActiveTrueAndAvailableTrueOrderByDisplayOrderAscNameAsc(Long productId);

    @EntityGraph(attributePaths = {"product", "product.category"})
    Optional<ProductVariant> findByIdAndProductId(Long id, Long productId);

    @Override
    @EntityGraph(attributePaths = {"product", "product.category"})
    Optional<ProductVariant> findById(Long id);

    boolean existsByProductIdAndNameIgnoreCase(Long productId, String name);

    boolean existsByProductIdAndNameIgnoreCaseAndIdNot(Long productId, String name, Long id);
}
