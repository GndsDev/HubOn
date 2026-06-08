package com.hubon.backend.category.service;

import com.hubon.backend.category.domain.Category;
import com.hubon.backend.category.dto.CategoryRequest;
import com.hubon.backend.category.dto.CategoryResponse;
import com.hubon.backend.category.repository.CategoryRepository;
import com.hubon.backend.shared.exception.BusinessException;
import com.hubon.backend.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryRepository categoryRepository;

    @Transactional(readOnly = true)
    public List<CategoryResponse> listAll() {
        return categoryRepository.findAllByOrderByDisplayOrderAscNameAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CategoryResponse create(CategoryRequest request) {
        if (categoryRepository.existsByNameIgnoreCase(request.name())) {
            throw new BusinessException("Já existe uma categoria com este nome");
        }

        Category category = Category.builder()
                .name(request.name().trim())
                .description(request.description())
                .displayOrder(request.displayOrder())
                .active(request.active())
                .build();

        return toResponse(categoryRepository.save(category));
    }

    @Transactional
    public CategoryResponse update(Long id, CategoryRequest request) {
        Category category = findEntityById(id);
        category.setName(request.name().trim());
        category.setDescription(request.description());
        category.setDisplayOrder(request.displayOrder() == null ? 0 : request.displayOrder());
        category.setActive(request.active() == null ? category.getActive() : request.active());

        return toResponse(category);
    }

    @Transactional
    public CategoryResponse activate(Long id) {
        Category category = findEntityById(id);
        category.setActive(true);
        return toResponse(category);
    }

    @Transactional
    public CategoryResponse deactivate(Long id) {
        Category category = findEntityById(id);
        category.setActive(false);
        return toResponse(category);
    }

    @Transactional(readOnly = true)
    public Category findEntityById(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada"));
    }

    private CategoryResponse toResponse(Category category) {
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getDescription(),
                category.getActive(),
                category.getDisplayOrder(),
                category.getCreatedAt(),
                category.getUpdatedAt()
        );
    }
}
