package com.hubon.backend.shared.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hubon.backend.auth.service.JwtAuthenticationFilter;
import com.hubon.backend.shared.exception.ApiErrorResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.LocalDateTime;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final boolean permitAll;
    private final List<String> allowedOrigins;
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;

    public SecurityConfig(
            @Value("${hubon.security.permit-all:false}") boolean permitAll,
            @Value("#{'${hubon.cors.allowed-origins:}'.split(',')}") List<String> allowedOrigins,
            JwtAuthenticationFilter jwtAuthenticationFilter,
            ObjectMapper objectMapper
    ) {
        this.permitAll = permitAll;
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.objectMapper = objectMapper;
        this.allowedOrigins = allowedOrigins.stream()
                .map(String::trim)
                .filter(origin -> !origin.isBlank())
                .toList();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint())
                        .accessDeniedHandler(accessDeniedHandler())
                )
                .authorizeHttpRequests(auth -> {
                    if (permitAll) {
                        auth.anyRequest().permitAll();
                    } else {
                        auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                        auth.requestMatchers("/api/auth/login").permitAll();

                        auth.requestMatchers("/api/dashboard/**").hasAnyRole("OWNER", "ADMIN");
                        auth.requestMatchers("/api/categories/**").hasAnyRole("OWNER", "ADMIN");
                        auth.requestMatchers("/api/products/**").hasAnyRole("OWNER", "ADMIN");
                        auth.requestMatchers("/api/users/**").hasAnyRole("OWNER", "ADMIN");
                        auth.requestMatchers("/api/roles/**").hasAnyRole("OWNER", "ADMIN");

                        auth.requestMatchers("/api/tables/*/current-tab")
                                .hasAnyRole("OWNER", "ADMIN", "WAITER", "CASHIER");
                        auth.requestMatchers("/api/tables/**")
                                .hasAnyRole("OWNER", "ADMIN", "WAITER");

                        auth.requestMatchers("/api/tabs/**")
                                .hasAnyRole("OWNER", "ADMIN", "WAITER", "CASHIER");

                        auth.requestMatchers(HttpMethod.GET, "/api/orders/**")
                                .hasAnyRole("OWNER", "ADMIN", "WAITER", "KITCHEN");
                        auth.requestMatchers(HttpMethod.PATCH, "/api/orders/*/status")
                                .hasAnyRole("OWNER", "ADMIN", "KITCHEN");
                        auth.requestMatchers(HttpMethod.POST, "/api/orders/*/send-to-kitchen")
                                .hasAnyRole("OWNER", "ADMIN", "WAITER");
                        auth.requestMatchers(HttpMethod.POST, "/api/orders/*/cancel")
                                .hasAnyRole("OWNER", "ADMIN", "WAITER");
                        auth.requestMatchers(HttpMethod.POST, "/api/orders")
                                .hasAnyRole("OWNER", "ADMIN", "WAITER");

                        auth.requestMatchers("/api/payments/**").hasAnyRole("OWNER", "ADMIN", "CASHIER");

                        auth.anyRequest().authenticated();
                    }
                })
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, exception) -> writeError(
                response,
                "Autenticação necessária",
                HttpStatus.UNAUTHORIZED
        );
    }

    private AccessDeniedHandler accessDeniedHandler() {
        return (request, response, exception) -> writeError(
                response,
                "Acesso negado",
                HttpStatus.FORBIDDEN
        );
    }

    private void writeError(
            HttpServletResponse response,
            String message,
            HttpStatus status
    ) throws java.io.IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(
                response.getWriter(),
                new ApiErrorResponse(message, status.value(), LocalDateTime.now())
        );
    }
}
