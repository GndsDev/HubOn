package com.hubon.backend.shared.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class BusinessTimeConfig {

    @Bean
    Clock businessClock(@Value("${hubon.business-zone-id:America/Sao_Paulo}") String zoneId) {
        return Clock.system(ZoneId.of(zoneId));
    }
}
