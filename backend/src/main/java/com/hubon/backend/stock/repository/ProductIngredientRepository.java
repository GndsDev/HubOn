package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.ProductIngredient;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductIngredientRepository extends JpaRepository<ProductIngredient, Long> {

    @EntityGraph(attributePaths = {"product", "ingredient"})
    @Query("""
            select productIngredient
            from ProductIngredient productIngredient
            where productIngredient.product.id = :productId
            order by productIngredient.ingredient.name asc
            """)
    List<ProductIngredient> findAllByProductIdOrderByIngredientName(@Param("productId") Long productId);

    Optional<ProductIngredient> findByProductIdAndIngredientId(Long productId, Long ingredientId);

    boolean existsByProductIdAndIngredientId(Long productId, Long ingredientId);
}
