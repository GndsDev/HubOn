package com.hubon.backend;

import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.core.env.Environment;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

class IntegrationTestDatabaseGuard implements ApplicationContextInitializer<ConfigurableApplicationContext> {

    @Override
    public void initialize(ConfigurableApplicationContext applicationContext) {
        Environment environment = applicationContext.getEnvironment();
        String url = environment.getRequiredProperty("spring.datasource.url");
        String username = environment.getRequiredProperty("spring.datasource.username");
        String password = environment.getRequiredProperty("spring.datasource.password");

        try (
                Connection connection = DriverManager.getConnection(url, username, password);
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery("select current_database()")
        ) {
            result.next();
            assertDedicatedTestDatabase(result.getString(1));
        } catch (SQLException exception) {
            throw new IllegalStateException("Nao foi possivel validar o banco exclusivo de testes.", exception);
        }
    }

    private void assertDedicatedTestDatabase(String databaseName) {
        if (databaseName != null && (databaseName.endsWith("_test") || databaseName.endsWith("-test"))) {
            return;
        }
        throw new IllegalStateException(
                """
                Os testes de integracao nao podem ser executados no banco de desenvolvimento.
                Banco atual: %s
                Configure TEST_DB_URL apontando para um banco exclusivo de testes.
                """.formatted(databaseName).trim()
        );
    }
}
