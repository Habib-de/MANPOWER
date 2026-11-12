package com.manpower.dto;

// DTO for the response after initiating a PesaPal payment
public class PesaPalInitiateResponse {
    private String redirectUrl;
    private String orderTrackingId; // PesaPal's unique ID for the transaction

    // Ensure this constructor is present and correctly defined
    public PesaPalInitiateResponse(String redirectUrl, String orderTrackingId) {
        this.redirectUrl = redirectUrl;
        this.orderTrackingId = orderTrackingId;
    }

    // Getters and Setters
    public String getRedirectUrl() {
        return redirectUrl;
    }

    public void setRedirectUrl(String redirectUrl) {
        this.redirectUrl = redirectUrl;
    }

    public String getOrderTrackingId() {
        return orderTrackingId;
    }

    public void setOrderTrackingId(String orderTrackingId) {
        this.orderTrackingId = orderTrackingId;
    }
}
