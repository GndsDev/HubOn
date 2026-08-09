import { Product, ProductOption, ProductOptionGroup } from '../models/product.model';

function option(
  id: number,
  groupId: number,
  name: string,
  additionalPrice = 0,
): ProductOption {
  return {
    id,
    groupId,
    name,
    additionalPrice,
    displayOrder: 0,
    active: true,
    stockLink: null,
    createdAt: '',
    updatedAt: '',
  };
}

function group(
  id: number,
  productId: number,
  name: string,
  options: ProductOption[],
  displayOrder = 0,
): ProductOptionGroup {
  return {
    id,
    productId,
    name,
    minimumSelections: 1,
    maximumSelections: 1,
    displayOrder,
    active: true,
    options,
    createdAt: '',
    updatedAt: '',
  };
}

function product(
  id: number,
  categoryName: string,
  name: string,
  description: string,
  price: number,
  optionGroups: ProductOptionGroup[],
): Product {
  return {
    id,
    categoryId: id,
    categoryName,
    name,
    description,
    price,
    active: true,
    available: true,
    displayOrder: 0,
    optionGroups,
    createdAt: '',
    updatedAt: '',
  };
}

function completeMeal(id: number, name: string): Product {
  const beanGroupId = id * 10 + 1;
  const skewerGroupId = id * 10 + 2;
  return product(
    id,
    'Jantinhas',
    name,
    'Arroz branco, feijão, mandioca, vinagrete e 1 espeto.',
    30,
    [
      group(beanGroupId, id, 'Escolha o feijão', [
        option(id * 100 + 1, beanGroupId, 'Feijão tropeiro'),
        option(id * 100 + 2, beanGroupId, 'Feijão de caldo'),
      ]),
      group(skewerGroupId, id, 'Escolha o espeto', [
        option(id * 100 + 3, skewerGroupId, 'Picanha montada'),
        option(id * 100 + 4, skewerGroupId, 'Carne de sol'),
      ], 1),
    ],
  );
}

export function saleMenuProducts(): Product[] {
  const portionId = 103;
  const sizeGroupId = 1031;
  return [
    completeMeal(101, 'Jantinha completa'),
    completeMeal(102, 'Carreteiro completo'),
    product(
      portionId,
      'Porções',
      'Arroz branco',
      'Porção de arroz branco.',
      10,
      [group(sizeGroupId, portionId, 'Tamanho', [
        option(10301, sizeGroupId, 'Média'),
        option(10302, sizeGroupId, 'Grande', 8),
      ])],
    ),
    product(104, 'Bebidas', 'Água mineral', 'Garrafa individual.', 5, []),
  ];
}
