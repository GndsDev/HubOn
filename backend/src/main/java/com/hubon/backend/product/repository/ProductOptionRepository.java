package com.hubon.backend.product.repository;

import com.hubon.backend.product.domain.ProductOption;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProductOptionRepository extends JpaRepository<ProductOption, Long> {

    @EntityGraph(attributePaths = {"group", "group.product"})
    List<ProductOption> findAllByIdIn(Collection<Long> ids);

    @EntityGraph(attributePaths = {"group", "group.product"})
    Optional<ProductOption> findByIdAndGroupId(Long id, Long groupId);

    boolean existsByGroupIdAndNameIgnoreCase(Long groupId, String name);

    boolean existsByGroupIdAndNameIgnoreCaseAndIdNot(Long groupId, String name, Long id);
}
