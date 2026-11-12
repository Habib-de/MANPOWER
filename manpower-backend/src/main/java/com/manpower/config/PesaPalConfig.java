package com.manpower.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.PropertySource;

// Configuration class to load PesaPal API credentials from application.properties
@Configuration
@PropertySource("classpath:application.properties") // Ensure your properties are in this file
public class PesaPalConfig {

    @Value("${pesapal.api.base-url}")
    private String pesapalApiBaseUrl;

    @Value("${pesapal.consumer.key}")
    private String pesapalConsumerKey;

    @Value("${pesapal.consumer.secret}")
    private String pesapalConsumerSecret;

    @Value("${pesapal.callback.url}") // FIX: Corrected typo from 'pesapesal' to 'pesapal'
    private String pesapalCallbackUrl;

    // Getters
    public String getPesapalApiBaseUrl() {
        return pesapalApiBaseUrl;
    }

    public String getPesapalConsumerKey() {
        return pesapalConsumerKey;
    }

    public String getPesapalConsumerSecret() {
        return pesapalConsumerSecret;
    }

    public String getPesapalCallbackUrl() {
        return pesapalCallbackUrl;
    }

    // You might also add setters if needed, but typically config values are read-only
}
