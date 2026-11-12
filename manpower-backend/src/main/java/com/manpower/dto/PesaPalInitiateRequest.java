package com.manpower.dto;

import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;

// DTO for initiating a PesaPal payment from the frontend
public class PesaPalInitiateRequest {

    @NotBlank(message = "Member ID is required")
    private String memberId;

    @NotBlank(message = "Group ID is required")
    private String groupId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
    private BigDecimal amount;

    @NotBlank(message = "Transaction type is required")
    private String transactionType; // e.g., "Monthly", "Emergency"

    private String description;

    @NotBlank(message = "Mansoft Tenant ID is required")
    private String mansoftTenantId;

    @NotBlank(message = "Phone number is required for PesaPal")
    private String phoneNumber; // Phone number for M-Pesa push

    private String createdBy; // Added createdBy field

    // Getters and Setters
    public String getMemberId() {
        return memberId;
    }

    public void setMemberId(String memberId) {
        this.memberId = memberId;
    }

    public String getGroupId() {
        return groupId;
    }

    public void setGroupId(String groupId) {
        this.groupId = groupId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getTransactionType() {
        return transactionType;
    }

    public void setTransactionType(String transactionType) {
        this.transactionType = transactionType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getMansoftTenantId() {
        return mansoftTenantId;
    }

    public void setMansoftTenantId(String mansoftTenantId) {
        this.mansoftTenantId = mansoftTenantId;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getCreatedBy() { // FIX: Proper implementation
        return createdBy;
    }

    public void setCreatedBy(String createdBy) { // FIX: Proper implementation
        this.createdBy = createdBy;
    }
}
