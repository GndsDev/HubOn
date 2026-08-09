INSERT INTO roles (name, description) VALUES
    ('OWNER', 'Dono ou responsavel maximo pelo sistema'),
    ('ADMIN', 'Administrador do sistema'),
    ('WAITER', 'Atendimento'),
    ('KITCHEN', 'Perfil estrutural legado'),
    ('CASHIER', 'Caixa')
ON CONFLICT (name) DO NOTHING;
