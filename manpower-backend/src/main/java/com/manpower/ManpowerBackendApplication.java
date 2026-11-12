package com.manpower;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;  // ← ADD THIS IMPORT
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
@EnableScheduling  // ← ADD THIS LINE - Enables automatic reminders and penalties
public class ManpowerBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(ManpowerBackendApplication.class, args);
        System.out.println("✅ MANPOWER Backend Application Running...");
        System.out.println("✅ Scheduling enabled - Auto reminders & penalties active");
    }

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}