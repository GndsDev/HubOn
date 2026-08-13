import { Product, ProductOption, ProductOptionGroup } from '../models/product.model';

const SKEWERS = [
  'Picanha Montada',
  'Carne de Sol',
  'Contra Filé',
  'Cupim',
  'Kafta',
  'Kafta com Mussarela',
  'Medalhão de Carne',
  'Suína Gourmet',
  'Meio Asa',
  'Pão de Alho',
  'Panceta Suína',
  'Alcatra Magra',
  'Coração',
  'Linguiça com Pimenta',
  'Linguiça Toscana',
  'Medalhão de Frango',
  'Peito de Frango',
  'Queijo Coalho',
  'Queijo Provolone',
];

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

function completeMeal(id: number, name: string, description: string): Product {
  const beanGroupId = id * 10 + 1;
  const skewerGroupId = id * 10 + 2;
  return product(
    id,
    'Pratos',
    name,
    description,
    34.9,
    [
      group(beanGroupId, id, 'Escolha o feijão', [
        option(id * 100 + 1, beanGroupId, 'Tropeiro'),
        option(id * 100 + 2, beanGroupId, 'De caldo'),
      ]),
      group(
        skewerGroupId,
        id,
        'Escolha o espeto',
        SKEWERS.map((name, index) => option(id * 100 + 3 + index, skewerGroupId, name)),
        1,
      ),
    ],
  );
}

export function saleMenuProducts(): Product[] {
  const withoutSkewerId = 103;
  const withoutSkewerGroupId = 1031;
  const choripanId = 104;
  const choripanGroupId = 1041;
  const portionId = 105;
  const sizeGroupId = 1051;
  return [
    completeMeal(
      101,
      'Jantinha Completa',
      'Arroz branco, feijão tropeiro ou de caldo, mandioca, vinagrete e 1 espeto',
    ),
    completeMeal(
      102,
      'Carreteiro Completo',
      'Arroz carreteiro, feijão tropeiro ou de caldo, mandioca, vinagrete e 1 espeto',
    ),
    product(
      withoutSkewerId,
      'Pratos',
      'Jantinha Sem Espeto',
      'Arroz branco, feijão tropeiro ou de caldo, mandioca e vinagrete',
      22,
      [group(withoutSkewerGroupId, withoutSkewerId, 'Escolha o feijão', [
        option(10301, withoutSkewerGroupId, 'Tropeiro'),
        option(10302, withoutSkewerGroupId, 'De caldo'),
      ])],
    ),
    product(
      choripanId,
      'Pratos',
      'Choripan',
      '1 espeto de preferência, molho da casa, tomate, cebola e mussarela',
      25,
      [group(
        choripanGroupId,
        choripanId,
        'Escolha o espeto',
        SKEWERS.map((name, index) => option(10401 + index, choripanGroupId, name)),
      )],
    ),
    product(
      portionId,
      'Porções',
      'Arroz Branco',
      'Porção de arroz branco',
      10,
      [group(sizeGroupId, portionId, 'Tamanho', [
        option(10501, sizeGroupId, 'Média'),
        option(10502, sizeGroupId, 'Grande', 8),
      ])],
    ),
    product(106, 'Espetinhos', 'Picanha Montada', '', 12.9, []),
    product(107, 'Bebidas', 'Refri Lata', '', 7, []),
    product(108, 'Bebidas', 'Água Natural', '', 4, []),
    product(109, 'Bebidas', 'Red Bull', '', 15, []),
  ];
}
