package com.manpower.dto;

// This class provides a standardized format for error responses from your API.
// It includes a message and an optional error code.
public class ErrorResponse {
    private String message;
    private String errorCode; // Optional: for specific error codes

    public ErrorResponse(String message) {
        this.message = message;
    }

    public ErrorResponse(String message, String errorCode) {
        this.message = message;
        this.errorCode = errorCode;
    }

    // Getters
    public String getMessage() {
        return message;
    }

    public String getErrorCode() {
        return errorCode;
    }

    // Setters (optional, typically not needed for immutable error responses)
    // You can add these if you need to deserialize into this object later
    public void setMessage(String message) {
        this.message = message;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
    }
}
