package com.hubon.backend.stock.service;

import com.hubon.backend.product.domain.Product;
import com.hubon.backend.product.repository.ProductRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import com.hubon.backend.stock.domain.Ingredient;
import com.hubon.backend.stock.domain.ProductIngredient;
import com.hubon.backend.stock.dto.ProductIngredientRequest;
import com.hubon.backend.stock.dto.ProductIngredientResponse;
import com.hubon.backend.stock.dto.ProductRecipeResponse;
import com.hubon.backend.stock.repository.IngredientRepository;
import com.hubon.backend.stock.repository.ProductIngredientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ProductIngredientService {

    private final ProductIngredientRepository productIngredientRepository;
    private final ProductRepository productRepository;
    private final IngredientRepository ingredientRepository;

    @Transactional(readOnly = true)
    public ProductRecipeResponse getRecipeByProduct(Long productId) {
        Product product = findProduct(productId);
        List<ProductIngredientResponse> ingredients = productIngredientRepository
                .findAllByProductIdOrderByIngredientName(productId)
                .stream()
                .map(this::toResponse)
                .toList();
        return new ProductRecipeResponse(product.getId(), product.getName(), ingredients);
    }

    @Transactional
    public ProductIngredientResponse addIngredient(Long productId, ProductIngredientRequest request) {
        Product product = findProduct(productId);
        Ingredient ingredient = findIngredient(request.ingredientId());
        ensureProductActive(product);
        ensureIngredientActive(ingredient);
        validateQuantity(request.quantity());
        if (productIngredientRepository.existsByProductIdAndIngredientId(productId, request.ingredientId())) {
            throw new BusinessException("Ingrediente ja existe na ficha tecnica deste produto");
        }

        ProductIngredient productIngredient = ProductIngredient.builder()
                .product(product)
                .ingredient(ingredient)
                .quantity(request.quantity())
                .build();

        return toResponse(productIngredientRepository.save(productIngredient));
    }

    @Transactional
    public ProductIngredientResponse updateIngredientQuantity(
            Long productId,
            Long ingredientId,
            ProductIngredientRequest request
    ) {
        if (!ingredientId.equals(request.ingredientId())) {
            throw new BusinessException("Ingrediente da rota deve ser igual ao ingrediente do corpo da requisicao");
        }
        Product product = findProduct(productId);
        Ingredient ingredient = findIngredient(ingredientId);
        ensureProductActive(product);
        ensureIngredientActive(ingredient);
        validateQuantity(request.quantity());

        ProductIngredient productIngredient = productIngredientRepository
                .findByProductIdAndIngredientId(productId, ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingrediente nao encontrado na ficha tecnica"));
        productIngredient.setQuantity(request.quantity());

        return toResponse(productIngredient);
    }

    @Transactional
    public void removeIngredient(Long productId, Long ingredientId) {
        ProductIngredient productIngredient = productIngredientRepository
                .findByProductIdAndIngredientId(productId, ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingrediente nao encontrado na ficha tecnica"));
        productIngredientRepository.delete(productIngredient);
    }

    @Transactional
    public ProductRecipeResponse replaceRecipe(Long productId, List<ProductIngredientRequest> requests) {
        Product product = findProduct(productId);
        ensureProductActive(product);
        List<ProductIngredientRequest> safeRequests = requests == null ? List.of() : requests;
        List<Ingredient> ingredients = validateRecipeRequests(safeRequests);

        List<ProductIngredient> currentItems = productIngredientRepository.findAllByProductIdOrderByIngredientName(productId);
        productIngredientRepository.deleteAll(currentItems);
        productIngredientRepository.flush();

        for (int index = 0; index < safeRequests.size(); index++) {
            ProductIngredientRequest request = safeRequests.get(index);
            ProductIngredient productIngredient = ProductIngredient.builder()
                    .product(product)
                    .ingredient(ingredients.get(index))
                    .quantity(request.quantity())
                    .build();
            productIngredientRepository.save(productIngredient);
        }

        return getRecipeByProduct(productId);
    }

    private List<Ingredient> validateRecipeRequests(List<ProductIngredientRequest> requests) {
        Set<Long> ingredientIds = new HashSet<>();
        for (ProductIngredientRequest request : requests) {
            if (request.ingredientId() == null) {
                throw new BusinessException("Ingrediente e obrigatorio na ficha tecnica");
            }
            if (!ingredientIds.add(request.ingredientId())) {
                throw new BusinessException("Ficha tecnica nao pode conter ingredientes duplicados");
            }
            validateQuantity(request.quantity());
        }

        List<Ingredient> ingredients = requests.stream()
                .map(request -> findIngredient(request.ingredientId()))
                .toList();
        ingredients.forEach(this::ensureIngredientActive);
        return ingredients;
    }

    private Product findProduct(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto nao encontrado"));
    }

    private Ingredient findIngredient(Long ingredientId) {
        return ingredientRepository.findById(ingredientId)
                .orElseThrow(() -> new ResourceNotFoundException("Ingrediente nao encontrado"));
    }

    private void ensureProductActive(Product product) {
        if (!Boolean.TRUE.equals(product.getActive())) {
            throw new BusinessException("Produto inativo nao pode ter ficha tecnica alterada");
        }
    }

    private void ensureIngredientActive(Ingredient ingredient) {
        if (!Boolean.TRUE.equals(ingredient.getActive())) {
            throw new BusinessException("Ingrediente inativo nao pode ser usado na ficha tecnica");
        }
    }

    private void validateQuantity(BigDecimal quantity) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Quantidade da ficha tecnica deve ser maior que zero");
        }
    }

    private ProductIngredientResponse toResponse(ProductIngredient productIngredient) {
        return new ProductIngredientResponse(
                productIngredient.getId(),
                productIngredient.getIngredient().getId(),
                productIngredient.getIngredient().getName(),
                productIngredient.getIngredient().getUnit(),
                productIngredient.getQuantity()
        );
    }
}
