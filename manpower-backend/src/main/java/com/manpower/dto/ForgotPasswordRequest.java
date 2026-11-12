package com.manpower.dto;

import javax.validation.constraints.Email;
import javax.validation.constraints.NotBlank;

// DTO for the forgot password request from the frontend
public class ForgotPasswordRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    // Default constructor
    public ForgotPasswordRequest() {
    }

    // Constructor
    public ForgotPasswordRequest(String email) {
        this.email = email;
    }

    // Getter
    public String getEmail() {
        return email;
    }

    // Setter
    public void setEmail(String email) {
        this.email = email;
    }
}
