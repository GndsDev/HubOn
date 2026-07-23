package com.hubon.backend.stock.repository;

import com.hubon.backend.stock.domain.Ingredient;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface IngredientRepository extends JpaRepository<Ingredient, Long> {

    List<Ingredient> findAllByOrderByNameAsc();

    List<Ingredient> findAllByActiveTrueOrderByNameAsc();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);

    List<Ingredient> findAllByActiveTrueAndCurrentStockOrderByNameAsc(BigDecimal currentStock);

    @Query("""
            select ingredient
            from Ingredient ingredient
            where ingredient.active = true
              and ingredient.currentStock <= ingredient.minimumStock
            order by ingredient.name asc
            """)
    List<Ingredient> findAllActiveAtOrBelowMinimumStock();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "3000"))
    @Query("select ingredient from Ingredient ingredient where ingredient.id = :id")
    Optional<Ingredient> findByIdForUpdate(@Param("id") Long id);
}
